import { NextRequest, NextResponse } from "next/server";
import {
  shopRepository,
  submitRegistration,
  upsertPortalAccountAfterRegister,
  loadPortalAuthSession,
} from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { verifyAppProxySignature, shopDomainFromProxy } from "@/lib/app-proxy";
import { rateLimit } from "@/lib/rate-limit";
import { withPublicCors, publicCorsPreflight } from "@/lib/public-cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return publicCorsPreflight(request.headers.get("origin"));
}

async function resolveShop(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const secret = process.env.SHOPIFY_API_SECRET ?? "";
  if (sp.get("signature") && !verifyAppProxySignature(sp, secret)) {
    return { error: NextResponse.json({ error: "Invalid proxy signature" }, { status: 401 }) };
  }
  const shopParam = shopDomainFromProxy(sp) ?? request.headers.get("x-aftersale-shop") ?? sp.get("shop");
  if (!shopParam) return { error: NextResponse.json({ error: "Missing shop" }, { status: 400 }) };
  const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
  if (!shop || shop.status === "UNINSTALLED") {
    return { error: NextResponse.json({ error: "Shop not found" }, { status: 404 }) };
  }
  return { shop };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const resolved = await resolveShop(request);
  if ("error" in resolved) {
    return withPublicCors(resolved.error!, origin);
  }
  const shop = resolved.shop;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await rateLimit({
    key: `register:${shop.id}:${ip}`,
    limit: 10,
    windowSeconds: 600,
  });
  if (!allowed) {
    return withPublicCors(
      NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 }),
      origin,
    );
  }

  const body = (await request.json()) as Record<string, string | boolean | undefined>;
  if (!body.email || typeof body.email !== "string") {
    return withPublicCors(NextResponse.json({ error: "Email is required" }, { status: 400 }), origin);
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const phoneCountry = typeof body.phoneCountry === "string" ? body.phoneCountry.trim() : undefined;
  const password = typeof body.password === "string" ? body.password : undefined;
  const createPortalAccount = Boolean(body.createPortalAccount) && Boolean(password);
  const firstName = typeof body.firstName === "string" ? body.firstName : undefined;
  const lastName = typeof body.lastName === "string" ? body.lastName : undefined;

  try {
    const result = await submitRegistration({
      shopId: shop.id,
      email: body.email,
      firstName,
      lastName,
      phone,
      serialNumber: typeof body.serialNumber === "string" ? body.serialNumber : undefined,
      purchaseDate: typeof body.purchaseDate === "string" ? new Date(body.purchaseDate) : null,
      sellerName: typeof body.sellerName === "string" ? body.sellerName : undefined,
      proofUrl: typeof body.proofUrl === "string" ? body.proofUrl : undefined,
      productTitle: typeof body.productTitle === "string" ? body.productTitle : undefined,
      shopifyProductId: typeof body.shopifyProductId === "string" ? body.shopifyProductId : undefined,
      shopifyVariantId: typeof body.shopifyVariantId === "string" ? body.shopifyVariantId : undefined,
      orderNumber: typeof body.orderNumber === "string" ? body.orderNumber : undefined,
      outsideShopify: Boolean(body.outsideShopify),
      source: typeof body.source === "string" ? body.source : "form",
    });

    let session = null;
    if (createPortalAccount && password) {
      const name = [firstName, lastName].filter(Boolean).join(" ").trim() || undefined;
      session = await upsertPortalAccountAfterRegister({
        shopId: shop.id,
        email: body.email,
        password,
        name,
        phone,
        phoneCountry,
      });
    } else {
      // Still return a soft session payload so the UI can land in the portal.
      session = await loadPortalAuthSession(
        shop.id,
        body.email.trim().toLowerCase(),
        "register",
        { name: [firstName, lastName].filter(Boolean).join(" ") || null, phone: phone ?? null },
      );
    }

    return withPublicCors(
      NextResponse.json({
        ok: true,
        status: result.registration.status,
        message: result.message,
        certificateToken: result.certificateToken,
        registrationId: result.registration.id,
        session,
      }),
      origin,
    );
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : null;
    if (code === "SERIAL_REQUIRED") {
      return withPublicCors(
        NextResponse.json({ error: "Serial number is required for this product." }, { status: 400 }),
        origin,
      );
    }
    const message = err instanceof Error ? err.message : "Registration failed";
    const status =
      message.includes("already has an account") || message.includes("already exists") ? 409 : 500;
    if (status === 409 || message.includes("Password") || message.includes("email")) {
      return withPublicCors(NextResponse.json({ error: message }, { status: status === 409 ? 409 : 400 }), origin);
    }
    console.error(err);
    return withPublicCors(NextResponse.json({ error: "Registration failed" }, { status: 500 }), origin);
  }
}
