import { prisma } from "@aftersale/db";
import { getOfflineSession, shopify } from "@/lib/shopify/client";

/**
 * When Shopify redirects back after charge approval, the webhook can lag.
 * Sync activeSubscriptions from Admin API into local billing rows.
 */
export async function syncShopifySubscriptionStatus(shopId: string, shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return null;
  if (shop.billingStatus !== "PENDING_APPROVAL" && !shop.shopifySubscriptionId) {
    return shop;
  }

  const session = await getOfflineSession(shopDomain);
  if (!session) return shop;

  const client = new shopify.clients.Graphql({ session });
  const result = await client.request(
    `#graphql
    query ActiveSubscriptions {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
          test
        }
      }
    }`,
  );

  const subs =
    (
      result.data as {
        currentAppInstallation?: {
          activeSubscriptions?: Array<{ id: string; status: string; name: string; test?: boolean }>;
        };
      }
    ).currentAppInstallation?.activeSubscriptions ?? [];

  const pendingCharge = await prisma.billingCharge.findFirst({
    where: { shopId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  const match =
    subs.find((s) => s.id === shop.shopifySubscriptionId) ??
    subs.find((s) => s.id === pendingCharge?.shopifyChargeId) ??
    subs.find((s) => s.status === "ACTIVE") ??
    null;

  if (!match) return shop;

  const status = match.status.toUpperCase();
  if (status !== "ACTIVE") return shop;

  if (pendingCharge) {
    await prisma.billingCharge.update({
      where: { id: pendingCharge.id },
      data: { status: "ACTIVE", activatedAt: new Date(), shopifyChargeId: match.id },
    });
  }

  return prisma.shop.update({
    where: { id: shopId },
    data: {
      billingStatus: "ACTIVE",
      shopifySubscriptionId: match.id,
      planId: pendingCharge?.planId ?? shop.planId,
    },
    include: { plan: true },
  });
}
