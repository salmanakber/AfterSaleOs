import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { exchangeSessionToken, SessionTokenStaleError } from "@/lib/shopify/client";

async function bootstrapShopProfile(shopDomain: string, accessToken: string, shopId: string) {
  try {
    const res = await fetch(`https://${shopDomain}/admin/api/2025-01/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.warn("[token-exchange] REST shop bootstrap", res.status, await res.text());
      return;
    }
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
    if (!s) return;
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
  } catch (err) {
    console.warn("[token-exchange] shop bootstrap failed", err);
  }
}

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
    if (session.accessToken) {
      await bootstrapShopProfile(shopDomain, session.accessToken, shopRow.id);
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
