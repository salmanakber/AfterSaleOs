import { NextRequest, NextResponse } from "next/server";
import { Session } from "@shopify/shopify-api";
import { shopify, sessionStorage } from "@/lib/shopify/client";
import { shopRepository, prisma } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const shop = url.searchParams.get("shop");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("shopify_oauth_state")?.value;

  if (!shop || !code) {
    return NextResponse.json({ error: "Missing shop or code" }, { status: 400 });
  }

  if (cookieState && state && cookieState !== state) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 403 });
  }

  const shopDomain = normalizeShopDomain(shop);
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const apiSecret = process.env.SHOPIFY_API_SECRET ?? "";

  const tokenRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json({ error: `Token exchange failed: ${text}` }, { status: 502 });
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token: string;
    scope: string;
  };

  const session = new Session({
    id: `offline_${shopDomain}`,
    shop: shopDomain,
    state: state ?? "",
    isOnline: false,
    accessToken: tokenJson.access_token,
    scope: tokenJson.scope,
  });
  await sessionStorage.storeSession(session);

  const shopRow = await shopRepository.ensureShop(shopDomain);

  // Fetch shop details via GraphQL
  try {
    const client = new shopify.clients.Graphql({ session });
    const data = await client.request(`#graphql
      query ShopBootstrap {
        shop {
          name
          email
          ianaTimezone
          currencyCode
          id
        }
      }
    `);
    const s = (data.data as { shop: { name: string; email: string; ianaTimezone: string; currencyCode: string; id: string } }).shop;
    await prisma.shop.update({
      where: { id: shopRow.id },
      data: {
        shopName: s.name,
        email: s.email,
        timezone: s.ianaTimezone,
        currency: s.currencyCode,
        shopifyShopId: s.id,
      },
    });
  } catch (err) {
    console.warn("Shop bootstrap GraphQL failed", err);
  }

  const fresh = await prisma.shop.findUniqueOrThrow({ where: { id: shopRow.id } });
  const host = url.searchParams.get("host");
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const needsPlan = !fresh.planId && !fresh.billingBypass;
  const path = needsPlan ? "/plans" : "/";
  const qs = new URLSearchParams({ shop: shopDomain });
  if (host) qs.set("host", host);
  if (needsPlan) qs.set("welcome", "1");
  const redirectTo = `${appUrl}${path}?${qs.toString()}`;

  const response = NextResponse.redirect(redirectTo);
  response.cookies.delete("shopify_oauth_state");
  response.cookies.delete("shopify_oauth_shop");
  return response;
}
