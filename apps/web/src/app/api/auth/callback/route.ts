import { NextRequest, NextResponse } from "next/server";
import { Session } from "@shopify/shopify-api";
import { persistShopifySession, shopify } from "@/lib/shopify/client";
import { shopRepository, prisma } from "@aftersale/db";
import { normalizeShopDomain, offlineSessionId } from "@aftersale/shared";
import { embeddedAdminAppUrl } from "@/lib/shopify/embedded-url";

async function bootstrapShopProfile(shopDomain: string, accessToken: string, shopId: string) {
  // Prefer REST shop.json — more tolerant right after install than GraphQL.
  try {
    const res = await fetch(`https://${shopDomain}/admin/api/2025-01/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        Accept: "application/json",
      },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        shop?: {
          name?: string;
          email?: string;
          iana_timezone?: string;
          currency?: string;
          id?: number;
        };
      };
      const s = json.shop;
      if (s) {
        await prisma.shop.update({
          where: { id: shopId },
          data: {
            shopName: s.name ?? undefined,
            email: s.email ?? undefined,
            timezone: s.iana_timezone ?? undefined,
            currency: s.currency ?? undefined,
            shopifyShopId: s.id != null ? `gid://shopify/Shop/${s.id}` : undefined,
            status: "ACTIVE",
          },
        });
        return;
      }
    } else {
      console.warn("[auth/callback] REST shop bootstrap", res.status, await res.text());
    }
  } catch (err) {
    console.warn("[auth/callback] REST shop bootstrap failed", err);
  }

  try {
    const session = new Session({
      id: offlineSessionId(shopDomain),
      shop: shopDomain,
      state: "",
      isOnline: false,
      accessToken,
    });
    const client = new shopify.clients.Graphql({ session });
    const data = await client.request(`#graphql
      query ShopBootstrap {
        shop { name email ianaTimezone currencyCode id }
      }
    `);
    const s = (
      data.data as {
        shop: {
          name: string;
          email: string;
          ianaTimezone: string;
          currencyCode: string;
          id: string;
        };
      }
    ).shop;
    await prisma.shop.update({
      where: { id: shopId },
      data: {
        shopName: s.name,
        email: s.email,
        timezone: s.ianaTimezone,
        currency: s.currencyCode,
        shopifyShopId: s.id,
        status: "ACTIVE",
      },
    });
  } catch (err) {
    console.warn("[auth/callback] GraphQL shop bootstrap failed", err);
  }
}

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

  // Public apps must request expiring offline tokens (Shopify rejects non-expiring Admin API tokens).
  const tokenRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
      expiring: 1,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json({ error: `Token exchange failed: ${text}` }, { status: 502 });
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token: string;
    scope: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };

  const session = new Session({
    id: offlineSessionId(shopDomain),
    shop: shopDomain,
    state: state ?? "",
    isOnline: false,
    accessToken: tokenJson.access_token,
    scope: tokenJson.scope,
    expires: tokenJson.expires_in
      ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000)
      : undefined,
  });
  if (tokenJson.refresh_token) {
    (session as Session & { refreshToken?: string }).refreshToken = tokenJson.refresh_token;
  }
  if (tokenJson.refresh_token_expires_in) {
    (session as Session & { refreshTokenExpires?: Date }).refreshTokenExpires = new Date(
      Date.now() + Number(tokenJson.refresh_token_expires_in) * 1000,
    );
  }
  await persistShopifySession(session);

  const shopRow = await shopRepository.ensureShop(shopDomain);
  await bootstrapShopProfile(shopDomain, tokenJson.access_token, shopRow.id);

  const fresh = await prisma.shop.findUniqueOrThrow({ where: { id: shopRow.id } });
  const host =
    url.searchParams.get("host") ?? request.cookies.get("shopify_oauth_host")?.value ?? null;
  const needsPlan = !fresh.planId && !fresh.billingBypass;
  const path = needsPlan ? "/plans?welcome=1" : "/";

  // Prefer returning to APP_URL with shop/host. Client then embeds via App Bridge
  // without bouncing Admin between /apps/aftersale-os and /apps/{apiKey}.
  const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  let redirectTo: string;
  if (appUrl) {
    const dest = new URL(path, `${appUrl}/`);
    dest.searchParams.set("shop", shopDomain);
    if (host) dest.searchParams.set("host", host);
    dest.searchParams.set("embedded", "1");
    redirectTo = dest.toString();
  } else {
    redirectTo = embeddedAdminAppUrl({ path, shop: shopDomain, host, apiKey });
  }

  const response = NextResponse.redirect(redirectTo);
  response.cookies.delete("shopify_oauth_state");
  response.cookies.delete("shopify_oauth_shop");
  response.cookies.delete("shopify_oauth_host");
  return response;
}
