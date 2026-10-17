import { NextRequest, NextResponse } from "next/server";
import { loginPortalAccount, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { withPublicCors, publicCorsPreflight } from "@/lib/public-cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return publicCorsPreflight(request.headers.get("origin"));
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try {
    const body = (await request.json()) as {
      shop?: string;
      email?: string;
      password?: string;
    };
    if (!body.shop || !body.email || !body.password) {
      return withPublicCors(
        NextResponse.json({ error: "shop, email, and password required" }, { status: 400 }),
        origin,
      );
    }

    const shop = await shopRepository.findByDomain(normalizeShopDomain(body.shop));
    if (!shop || shop.status === "UNINSTALLED") {
      return withPublicCors(NextResponse.json({ error: "Shop not found" }, { status: 404 }), origin);
    }

    const session = await loginPortalAccount({
      shopId: shop.id,
      email: body.email,
      password: body.password,
    });

    return withPublicCors(NextResponse.json(session), origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed";
    const status =
      message.includes("Incorrect") || message.includes("No account") || message.includes("required")
        ? 401
        : 400;
    return withPublicCors(NextResponse.json({ error: message }, { status }), origin);
  }
}
