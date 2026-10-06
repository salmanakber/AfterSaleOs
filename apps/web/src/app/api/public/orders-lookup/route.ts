import { NextRequest, NextResponse } from "next/server";
import { getPortalOrdersForEmail, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";

export const runtime = "nodejs";

/**
 * Order list for customer register/claim when Shopify customer email is known
 * (theme embed passes ?email=). Guests without email still use guest-link verify.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { shop?: string; email?: string; query?: string };
    const shopParam = body.shop || request.nextUrl.searchParams.get("shop");
    const email = (body.email ?? "").trim().toLowerCase();
    if (!shopParam || !email || !email.includes("@")) {
      return NextResponse.json({ error: "shop and email required" }, { status: 400 });
    }
    const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
    if (!shop || shop.status === "UNINSTALLED") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    let orders = await getPortalOrdersForEmail({ shopId: shop.id, email });
    const q = (body.query ?? "").trim().toLowerCase();
    if (q) {
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.lineItems.some((li) => li.title.toLowerCase().includes(q)),
      );
    }

    return NextResponse.json({
      email,
      orders,
      count: orders.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed" },
      { status: 500 },
    );
  }
}
