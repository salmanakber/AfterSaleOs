import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { getOfflineSession, shopify } from "@/lib/shopify/client";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.json({ connected: false, error: "Missing shop" }, { status: 400 });

  const shopDomain = normalizeShopDomain(shop);
  const shopRow = await shopRepository.findByDomain(shopDomain);
  const session = await getOfflineSession(shopDomain);

  if (!shopRow || !session) {
    return NextResponse.json({
      connected: false,
      shop: shopDomain,
      needsAuth: true,
    });
  }

  let reachable = false;
  try {
    const client = new shopify.clients.Graphql({ session });
    await client.request(`{ shop { name } }`);
    reachable = true;
  } catch {
    reachable = false;
  }

  return NextResponse.json({
    connected: reachable,
    shop: shopDomain,
    shopId: shopRow.id,
    plan: shopRow.planId,
    status: shopRow.status,
    needsAuth: !reachable,
  });
}
