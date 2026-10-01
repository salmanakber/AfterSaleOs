import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";

/**
 * Background webhook processor.
 * Order/product sync and warranty creation expand in M1.
 */
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
      case "refunds/create":
      case "products/update":
      case "customers/update":
        // M1: sync + warranty engine
        console.log(`[webhook] queued domain sync for ${event.topic}`, {
          shop: event.shopDomain,
        });
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

async function handleSubscriptionUpdate(shopId: string | undefined, payload: unknown) {
  if (!shopId) return;
  const p = payload as {
    app_subscription?: { admin_graphql_api_id?: string; status?: string; name?: string };
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
