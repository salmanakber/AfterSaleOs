import { NextRequest, NextResponse } from "next/server";
import { shopRepository, submitRegistration } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { verifyAppProxySignature, shopDomainFromProxy } from "@/lib/app-proxy";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

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
  const resolved = await resolveShop(request);
  if ("error" in resolved) return resolved.error;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await rateLimit({
    key: `register:${resolved.shop.id}:${ip}`,
    limit: 10,
    windowSeconds: 600,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = (await request.json()) as Record<string, string | boolean | undefined>;
  if (!body.email || typeof body.email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const result = await submitRegistration({
      shopId: resolved.shop.id,
      email: body.email,
      firstName: typeof body.firstName === "string" ? body.firstName : undefined,
      lastName: typeof body.lastName === "string" ? body.lastName : undefined,
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

    return NextResponse.json({
      ok: true,
      status: result.registration.status,
      message: result.message,
      certificateToken: result.certificateToken,
      registrationId: result.registration.id,
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : null;
    if (code === "SERIAL_REQUIRED") {
      return NextResponse.json({ error: "Serial number is required for this product." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
