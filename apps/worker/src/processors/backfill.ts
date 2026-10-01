import { prisma } from "@aftersale/db";
import { createWarrantiesForOrderLine } from "@aftersale/db";
import { shopifyGraphqlRequest } from "../shopify";

const ORDERS_QUERY = `#graphql
  query OrdersBackfill($cursor: String, $query: String) {
    orders(first: 50, after: $cursor, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          name
          email
          processedAt
          createdAt
          cancelledAt
          displayFinancialStatus
          displayFulfillmentStatus
          customer { id email firstName lastName phone }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                sku
                quantity
                originalUnitPriceSet { shopMoney { amount } }
                variant { id }
                product { id }
              }
            }
          }
          fulfillments(first: 5) { createdAt status }
        }
      }
    }
  }
`;

function shopifyGidToLegacyId(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1]!;
}

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/**
 * Paginated historical order backfill (GraphQL Admin).
 * Resumable via job.payload.cursor. Respects lookback months.
 * Note: without read_all_orders / protected data approval, Shopify may only return ~60 days.
 */
export async function runBackfillJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: job.shopId } });
  const payload = (job.payload ?? {}) as {
    lookbackMonths?: number | null;
    cursor?: string | null;
    processedOrders?: number;
  };

  const lookback = payload.lookbackMonths ?? shop.backfillLookbackMonths ?? 12;
  const query =
    lookback <= 0 ? undefined : `created_at:>=${monthsAgoIso(lookback)}`;

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: job.startedAt ?? new Date() },
  });

  let cursor = payload.cursor ?? null;
  let processedOrders = payload.processedOrders ?? 0;
  let warrantiesCreated = 0;
  let page = 0;

  try {
    while (page < 500) {
      page++;
      const data = await shopifyGraphqlRequest<{
        orders: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          edges: Array<{ node: Record<string, unknown> }>;
        };
      }>(shop.shopDomain, ORDERS_QUERY, { cursor, query });

      const edges = data.orders.edges;
      for (const edge of edges) {
        const node = edge.node as {
          id: string;
          name: string;
          email?: string;
          processedAt?: string;
          createdAt: string;
          cancelledAt?: string;
          displayFinancialStatus?: string;
          displayFulfillmentStatus?: string;
          customer?: {
            id: string;
            email?: string;
            firstName?: string;
            lastName?: string;
            phone?: string;
          };
          lineItems: {
            edges: Array<{
              node: {
                id: string;
                title: string;
                sku?: string;
                quantity: number;
                originalUnitPriceSet?: { shopMoney?: { amount?: string } };
                variant?: { id: string };
                product?: { id: string };
              };
            }>;
          };
          fulfillments?: Array<{ createdAt?: string; status?: string }>;
        };

        const shopifyOrderId = shopifyGidToLegacyId(node.id);
        let customerId: string | undefined;
        if (node.customer?.id) {
          const shopifyCustomerId = shopifyGidToLegacyId(node.customer.id);
          const customer = await prisma.customer.upsert({
            where: { shopId_shopifyCustomerId: { shopId: shop.id, shopifyCustomerId } },
            create: {
              shopId: shop.id,
              shopifyCustomerId,
              email: node.customer.email?.toLowerCase(),
              firstName: node.customer.firstName,
              lastName: node.customer.lastName,
              phone: node.customer.phone,
            },
            update: {
              email: node.customer.email?.toLowerCase(),
              firstName: node.customer.firstName,
              lastName: node.customer.lastName,
            },
          });
          customerId = customer.id;
        }

        const fulfilledAt =
          node.displayFulfillmentStatus === "FULFILLED" ||
          node.displayFulfillmentStatus === "PARTIAL"
            ? node.fulfillments?.[0]?.createdAt
              ? new Date(node.fulfillments[0].createdAt)
              : node.processedAt
                ? new Date(node.processedAt)
                : new Date(node.createdAt)
            : null;

        const dbOrder = await prisma.order.upsert({
          where: {
            shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId },
          },
          create: {
            shopId: shop.id,
            shopifyOrderId,
            orderNumber: node.name,
            customerId,
            email: node.email?.toLowerCase(),
            financialStatus: node.displayFinancialStatus,
            fulfillmentStatus: node.displayFulfillmentStatus,
            processedAt: node.processedAt ? new Date(node.processedAt) : new Date(node.createdAt),
            fulfilledAt: fulfilledAt ?? undefined,
            cancelledAt: node.cancelledAt ? new Date(node.cancelledAt) : undefined,
            currency: shop.currency,
          },
          update: {
            customerId,
            email: node.email?.toLowerCase(),
            financialStatus: node.displayFinancialStatus,
            fulfillmentStatus: node.displayFulfillmentStatus,
            fulfilledAt: fulfilledAt ?? undefined,
            cancelledAt: node.cancelledAt ? new Date(node.cancelledAt) : undefined,
          },
        });

        for (const li of node.lineItems.edges) {
          const item = li.node;
          const shopifyLineItemId = shopifyGidToLegacyId(item.id);
          const shopifyProductId = item.product?.id
            ? shopifyGidToLegacyId(item.product.id)
            : null;
          const shopifyVariantId = item.variant?.id
            ? shopifyGidToLegacyId(item.variant.id)
            : null;
          const amount = item.originalUnitPriceSet?.shopMoney?.amount;
          const priceCents = amount ? Math.round(parseFloat(amount) * 100) : null;

          let collectionIds: string[] = [];
          if (shopifyProductId) {
            const product = await prisma.product.findUnique({
              where: {
                shopId_shopifyProductId: { shopId: shop.id, shopifyProductId },
              },
            });
            collectionIds = product?.collectionIds ?? [];
          }

          const line = await prisma.orderLineItem.upsert({
            where: {
              shopId_shopifyLineItemId: { shopId: shop.id, shopifyLineItemId },
            },
            create: {
              shopId: shop.id,
              orderId: dbOrder.id,
              shopifyLineItemId,
              shopifyProductId: shopifyProductId ?? undefined,
              shopifyVariantId: shopifyVariantId ?? undefined,
              title: item.title,
              sku: item.sku,
              quantity: item.quantity,
              priceCents: priceCents ?? undefined,
            },
            update: {
              title: item.title,
              sku: item.sku,
              quantity: item.quantity,
              priceCents: priceCents ?? undefined,
            },
          });

          if (!dbOrder.cancelledAt) {
            const { warranties } = await createWarrantiesForOrderLine({
              shopId: shop.id,
              orderId: dbOrder.id,
              orderLineItemId: line.id,
              shopifyProductId,
              shopifyVariantId,
              collectionIds,
              quantity: item.quantity,
              customerId,
              purchaseAt: dbOrder.processedAt ?? dbOrder.createdAt,
              fulfilledAt: dbOrder.fulfilledAt,
              deliveredAt: dbOrder.deliveredAt,
              timeZone: shop.timezone,
              source: "BACKFILL",
            });
            warrantiesCreated += warranties.length;
          }
        }

        processedOrders++;
      }

      cursor = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;

      await prisma.job.update({
        where: { id: jobId },
        data: {
          progress: processedOrders,
          payload: {
            lookbackMonths: lookback,
            cursor,
            processedOrders,
            warrantiesCreated,
          },
        },
      });

      if (!cursor) break;

      // Soft rate-limit pacing between pages
      await new Promise((r) => setTimeout(r, 250));
    }

    await prisma.shop.update({
      where: { id: shop.id },
      data: { backfillLookbackMonths: lookback },
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        total: processedOrders,
        progress: processedOrders,
        result: { processedOrders, warrantiesCreated, lookbackMonths: lookback },
      },
    });
  } catch (err) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorSummary: err instanceof Error ? err.message : String(err),
        payload: { lookbackMonths: lookback, cursor, processedOrders, warrantiesCreated },
      },
    });
    throw err;
  }
}
