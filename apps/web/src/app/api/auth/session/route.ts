import { NextRequest, NextResponse } from "next/server";
import { sessionRepository, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import {
  getOfflineSession,
  refreshOfflineAccessToken,
  shopify,
} from "@/lib/shopify/client";
import { Session } from "@shopify/shopify-api";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.json({ connected: false, error: "Missing shop" }, { status: 400 });

  const shopDomain = normalizeShopDomain(shop);
  const shopRow = await shopRepository.findByDomain(shopDomain);
  let session = await getOfflineSession(shopDomain);

  // Only force re-auth when we have no offline token. A temporary Admin API blip
  // must NOT trigger top-level OAuth (that causes same_site_cookies + URL loops).
  if (!shopRow || !session) {
    return NextResponse.json({
      connected: false,
      shop: shopDomain,
      needsAuth: true,
    });
  }

  async function probe(s: Session): Promise<boolean> {
    try {
      const client = new shopify.clients.Graphql({ session: s });
      await client.request(`{ shop { name } }`);
      return true;
    } catch {
      return false;
    }
  }

  let reachable = await probe(session);

  // Access token rejected but refresh token still valid — renew quietly.
  if (!reachable) {
    const row = await sessionRepository.getOfflineSession(shopDomain);
    const refreshToken = row?.refreshToken;
    if (refreshToken) {
      try {
        session = await refreshOfflineAccessToken(shopDomain, refreshToken);
        reachable = await probe(session);
      } catch (err) {
        console.warn("[auth/session] refresh after probe failure", err);
      }
    }
  }

  return NextResponse.json({
    connected: reachable,
    shop: shopDomain,
    shopId: shopRow.id,
    plan: shopRow.planId,
    status: shopRow.status,
    needsAuth: false,
    needsTokenRefresh: !reachable,
  });
}
