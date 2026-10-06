import { NextRequest, NextResponse } from "next/server";
import { normalizeShopDomain } from "@aftersale/shared";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shopDomain = normalizeShopDomain(shop);
  const host = request.nextUrl.searchParams.get("host");
  const state = crypto.randomUUID();
  const redirectUri = `${process.env.APP_URL}/api/auth/callback`;
  const scopes = process.env.SHOPIFY_SCOPES ?? "";
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const authorize = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  authorize.searchParams.set("client_id", apiKey);
  authorize.searchParams.set("scope", scopes);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);

  const response = NextResponse.redirect(authorize.toString());
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
  // Remember host so callback can rebuild Admin embed URL if Shopify omits it.
  if (host) {
    response.cookies.set("shopify_oauth_host", host, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
  }
  return response;
}
