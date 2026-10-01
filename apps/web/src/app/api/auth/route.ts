import { NextRequest, NextResponse } from "next/server";
import { normalizeShopDomain } from "@aftersale/shared";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shopDomain = normalizeShopDomain(shop);
  const state = crypto.randomUUID();
  const redirectUri = `${process.env.APP_URL}/api/auth/callback`;
  const scopes = process.env.SHOPIFY_SCOPES ?? "";
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const url = `https://${shopDomain}/admin/oauth/authorize?client_id=${apiKey}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  // Persist state in a short cookie for CSRF
  const response = NextResponse.redirect(url);
  response.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set("shopify_oauth_shop", shopDomain, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return response;
}
