import { NextRequest, NextResponse } from "next/server";
import {
  getPortalOrdersForEmail,
  getPortalSessionForShopifyCustomer,
  getPortalWarranties,
  shopRepository,
} from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";

export const runtime = "nodejs";

/**
 * Load orders/warranties for a storefront customer.
 * Accepts Shopify app-proxy `logged_in_customer_id` and/or email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      shop?: string;
      email?: string;
      loggedInCustomerId?: string | number;
      customerId?: string | number;
    };
    const shopParam =
      body.shop ||
      request.nextUrl.searchParams.get("shop") ||
      request.nextUrl.searchParams.get("shop_domain");
    if (!shopParam) {
      return NextResponse.json({ error: "shop required" }, { status: 400 });
    }

    const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
    if (!shop || shop.status === "UNINSTALLED") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const customerId = String(
      body.loggedInCustomerId ?? body.customerId ?? request.nextUrl.searchParams.get("logged_in_customer_id") ?? "",
    ).replace(/\D/g, "");

    if (customerId) {
      const session = await getPortalSessionForShopifyCustomer({
        shopId: shop.id,
        shopifyCustomerId: customerId,
      });
      if (session) {
        return NextResponse.json({
          email: session.email,
          orders: session.orders,
          warranties: mapWarranties(session.warranties),
          source: "shopify_customer",
        });
      }
    }

    const email = (body.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "No orders found for this customer yet. Place an order or verify with email + order #." },
        { status: 404 },
      );
    }

    const [orders, warranties] = await Promise.all([
      getPortalOrdersForEmail({ shopId: shop.id, email }),
      getPortalWarranties({ shopId: shop.id, email }),
    ]);

    return NextResponse.json({
      email,
      orders,
      warranties: mapWarranties(warranties),
      source: "email",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed" },
      { status: 500 },
    );
  }
}

function mapWarranties(
  rows: Awaited<ReturnType<typeof getPortalWarranties>>,
) {
  return rows.map((w) => ({
    id: w.id,
    status: w.status,
    productTitle: w.warrantyUnit.orderLineItem.title,
    orderNumber: w.warrantyUnit.orderLineItem.order.orderNumber,
    serialNumber: w.warrantyUnit.serialNumber,
    certificateToken: w.certificateToken,
    startAt: w.startAt?.toISOString() ?? null,
    endAt: w.endAt?.toISOString() ?? null,
    ruleName: w.ruleVersion.rule.name,
  }));
}
