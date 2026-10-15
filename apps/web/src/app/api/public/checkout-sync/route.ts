import { NextRequest, NextResponse } from "next/server";
import { shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { rateLimit } from "@/lib/rate-limit";
import { syncOneOrderForShop } from "@/lib/shopify/sync-orders";

export const runtime = "nodejs";

/**
 * Called from the thank-you page extension after checkout.
 * Pulls the order via Admin API and creates warranties — works without PCD webhooks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      shop?: string;
      orderId?: string;
      orderName?: string;
      email?: string;
    };

    const shopParam = body.shop || request.nextUrl.searchParams.get("shop");
    if (!shopParam) {
      return NextResponse.json({ error: "shop required" }, { status: 400 });
    }
    if (!body.orderId && !body.orderName) {
      return NextResponse.json({ error: "orderId or orderName required" }, { status: 400 });
    }

    const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
    if (!shop || shop.status === "UNINSTALLED") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const allowed = await rateLimit({
      key: `checkout-sync:${shop.id}:${ip}`,
      limit: 30,
      windowSeconds: 600,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const result = await syncOneOrderForShop({
      shopId: shop.id,
      shopDomain: shop.shopDomain,
      orderGid: body.orderId,
      orderName: body.orderName,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      orderNumber: result.orderNumber,
      email: body.email ?? null,
      portalUrl: `https://aftersale.tidyflowapp.com/apps/aftersale/portal?shop=${encodeURIComponent(shop.shopDomain)}${body.email ? `&email=${encodeURIComponent(body.email)}` : ""}`,
    });
  } catch (err) {
    console.error("checkout-sync failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}
