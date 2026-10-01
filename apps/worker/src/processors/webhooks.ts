import { prisma, shopRepository, syncOrderFromWebhook, syncProductFromWebhook, voidWarrantiesOnRefund } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";

export async function processWebhookEvent(webhookEventId: string) {
  const event = await prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
  if (!event) return;
  if (event.status === "COMPLETED") return;

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });

  try {
    const shop = event.shopId
      ? await prisma.shop.findUnique({ where: { id: event.shopId } })
      : await shopRepository.findByDomain(normalizeShopDomain(event.shopDomain));

    switch (event.topic) {
      case "app_subscriptions/update":
        await handleSubscriptionUpdate(shop?.id, event.payload);
        break;
      case "orders/create":
      case "orders/updated":
      case "orders/cancelled":
        if (shop) await syncOrderFromWebhook(shop.id, event.payload);
        break;
      case "refunds/create":
        if (shop) await handleRefund(shop.id, event.payload);
        break;
      case "products/update":
      case "products/create":
        if (shop) await syncProductFromWebhook(shop.id, event.payload);
        break;
      case "customers/update":
        if (shop) await handleCustomerUpdate(shop.id, event.payload);
        break;
      default:
        console.log(`[webhook] unhandled topic ${event.topic}`);
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "COMPLETED", processedAt: new Date(), lastError: null },
    });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        lastError: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

async function handleRefund(shopId: string, payload: unknown) {
  const refund = payload as {
    order_id?: number | string;
    refund_line_items?: Array<{
      line_item_id?: number | string;
      quantity?: number;
      line_item?: { id?: number | string };
    }>;
  };
  if (!refund.order_id) return;

  await voidWarrantiesOnRefund({
    shopId,
    shopifyOrderId: String(refund.order_id),
    refundLineItems: (refund.refund_line_items ?? []).map((r) => ({
      shopifyLineItemId: String(r.line_item_id ?? r.line_item?.id ?? ""),
      quantity: r.quantity ?? 0,
    })).filter((r) => r.shopifyLineItemId && r.quantity > 0),
    reason: "refund",
  });
}

async function handleCustomerUpdate(shopId: string, payload: unknown) {
  const c = payload as {
    id?: number | string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
  if (!c.id) return;
  await prisma.customer.upsert({
    where: { shopId_shopifyCustomerId: { shopId, shopifyCustomerId: String(c.id) } },
    create: {
      shopId,
      shopifyCustomerId: String(c.id),
      email: c.email?.toLowerCase(),
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
    },
    update: {
      email: c.email?.toLowerCase(),
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
    },
  });
}

async function handleSubscriptionUpdate(shopId: string | undefined, payload: unknown) {
  if (!shopId) return;
  const p = payload as {
    app_subscription?: { admin_graphql_api_id?: string; status?: string };
  };
  const sub = p.app_subscription;
  if (!sub?.admin_graphql_api_id) return;

  const status = (sub.status ?? "").toUpperCase();
  const chargeStatus =
    status === "ACTIVE"
      ? "ACTIVE"
      : status === "DECLINED"
        ? "DECLINED"
        : status === "CANCELLED" || status === "EXPIRED"
          ? "CANCELLED"
          : "PENDING";

  await prisma.billingCharge.updateMany({
    where: { shopId, shopifyChargeId: sub.admin_graphql_api_id },
    data: {
      status: chargeStatus as "ACTIVE" | "DECLINED" | "CANCELLED" | "PENDING",
      activatedAt: chargeStatus === "ACTIVE" ? new Date() : undefined,
    },
  });

  if (chargeStatus === "ACTIVE") {
    const charge = await prisma.billingCharge.findFirst({
      where: { shopId, shopifyChargeId: sub.admin_graphql_api_id },
    });
    await prisma.shop.update({
      where: { id: shopId },
      data: {
        billingStatus: "ACTIVE",
        planId: charge?.planId ?? undefined,
        shopifySubscriptionId: sub.admin_graphql_api_id,
      },
    });
  } else if (chargeStatus === "DECLINED" || chargeStatus === "CANCELLED") {
    await prisma.shop.update({
      where: { id: shopId },
      data: { billingStatus: chargeStatus === "DECLINED" ? "DECLINED" : "CANCELLED" },
    });
  }
}
