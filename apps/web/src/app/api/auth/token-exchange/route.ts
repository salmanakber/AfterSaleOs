import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import {
  exchangeSessionToken,
  SessionTokenStaleError,
  shopify,
} from "@/lib/shopify/client";

/**
 * Embedded install / reconnect without cookie-based OAuth.
 * Exchanges App Bridge idToken → offline access token (avoids same_site_cookies).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!bearer) {
      return NextResponse.json({ error: "Missing session token" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { shop?: string };
    const shopHint = body.shop ? normalizeShopDomain(body.shop) : "";

    const session = await exchangeSessionToken(shopHint || "unknown.myshopify.com", bearer, "offline");
    const shopDomain = normalizeShopDomain(session.shop);
    const shopRow = await shopRepository.ensureShop(shopDomain);

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
        where: { id: shopRow.id },
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
      console.warn("[token-exchange] shop bootstrap failed", err);
    }

    const fresh = await prisma.shop.findUniqueOrThrow({ where: { id: shopRow.id } });
    return NextResponse.json({
      ok: true,
      shop: shopDomain,
      shopId: fresh.id,
      needsPlanSelection: !fresh.planId && !fresh.billingBypass,
    });
  } catch (err) {
    if (err instanceof SessionTokenStaleError) {
      const res = NextResponse.json({ error: err.message, code: "SESSION_TOKEN_STALE" }, { status: 401 });
      res.headers.set("X-Shopify-Retry-Invalid-Session-Request", "1");
      return res;
    }
    console.error("[token-exchange]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token exchange failed" },
      { status: 500 },
    );
  }
}
