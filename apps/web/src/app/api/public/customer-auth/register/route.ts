import { NextRequest, NextResponse } from "next/server";
import { registerPortalAccount, shopRepository } from "@aftersale/db";
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
      name?: string;
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

    const session = await registerPortalAccount({
      shopId: shop.id,
      email: body.email,
      password: body.password,
      name: body.name,
    });

    return withPublicCors(NextResponse.json(session), origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create account";
    const status = message.includes("already exists") ? 409 : 400;
    return withPublicCors(NextResponse.json({ error: message }, { status }), origin);
  }
}
