import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aftersale/db";
import { maybeAutoSyncRecentOrders } from "@/lib/shopify/sync-orders";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron / external scheduler: sync recent orders for all active shops.
 * Auth: Authorization: Bearer $CRON_SECRET  or  ?secret=$CRON_SECRET
 *
 * Example (every 5 min):
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://aftersale.tidyflowapp.com/api/cron/sync-orders
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.SHOPIFY_API_SECRET || "";
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = request.nextUrl.searchParams.get("secret") ?? "";
  if (!secret || (bearer !== secret && q !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await prisma.shop.findMany({
    where: { status: { not: "UNINSTALLED" } },
    select: { id: true, shopDomain: true },
    take: 50,
  });

  const results = [];
  for (const shop of list) {
    const result = await maybeAutoSyncRecentOrders({
      shopId: shop.id,
      shopDomain: shop.shopDomain,
      lookbackDays: 3,
      minIntervalMs: 2 * 60 * 1000,
    });
    results.push({ shop: shop.shopDomain, ...result });
  }

  return NextResponse.json({ ok: true, shops: results.length, results });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
