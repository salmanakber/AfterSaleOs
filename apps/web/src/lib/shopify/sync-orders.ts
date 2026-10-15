import { syncOrderFromWebhook, prisma } from "@aftersale/db";
import { shopifyGraphqlRequest } from "@/lib/shopify/client";

const ORDERS_RECENT_QUERY = `#graphql
  query OrdersRecentSync($cursor: String, $query: String) {
    orders(first: 25, after: $cursor, query: $query, sortKey: CREATED_AT, reverse: true) {
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
          customAttributes { key value }
          customer { id email firstName lastName phone }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                name
                sku
                quantity
                originalUnitPriceSet { shopMoney { amount } }
                variant { id }
                product { id }
                customAttributes { key value }
              }
            }
          }
          fulfillments(first: 5) { createdAt status }
        }
      }
    }
  }
`;

const ORDER_BY_ID_QUERY = `#graphql
  query OrderById($id: ID!) {
    order(id: $id) {
      id
      name
      email
      processedAt
      createdAt
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      customAttributes { key value }
      customer { id email firstName lastName phone }
      lineItems(first: 50) {
        edges {
          node {
            id
            title
            name
            sku
            quantity
            originalUnitPriceSet { shopMoney { amount } }
            variant { id }
            product { id }
            customAttributes { key value }
          }
        }
      }
      fulfillments(first: 5) { createdAt status }
    }
  }
`;

const ORDER_BY_NAME_QUERY = `#graphql
  query OrderByName($query: String!) {
    orders(first: 1, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges { node {
        id
        name
        email
        processedAt
        createdAt
        cancelledAt
        displayFinancialStatus
        displayFulfillmentStatus
        customAttributes { key value }
        customer { id email firstName lastName phone }
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              name
              sku
              quantity
              originalUnitPriceSet { shopMoney { amount } }
              variant { id }
              product { id }
              customAttributes { key value }
            }
          }
        }
        fulfillments(first: 5) { createdAt status }
      } }
    }
  }
`;

type GqlAttr = { key?: string; value?: string };
type GqlOrderNode = {
  id: string;
  name: string;
  email?: string | null;
  processedAt?: string | null;
  createdAt: string;
  cancelledAt?: string | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  customAttributes?: GqlAttr[];
  customer?: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  } | null;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title?: string;
        name?: string;
        sku?: string | null;
        quantity: number;
        originalUnitPriceSet?: { shopMoney?: { amount?: string } };
        variant?: { id: string } | null;
        product?: { id: string } | null;
        customAttributes?: GqlAttr[];
      };
    }>;
  };
  fulfillments?: Array<{ createdAt?: string; status?: string }>;
};

type OrdersPageResult = {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ node: GqlOrderNode }>;
  };
};

function gidNum(gid: string | null | undefined): string | null {
  if (!gid) return null;
  const parts = gid.split("/");
  return parts[parts.length - 1] ?? null;
}

/** Convert Admin GraphQL order → REST-shaped payload for syncOrderFromWebhook. */
export function graphqlOrderToWebhookPayload(node: GqlOrderNode) {
  return {
    id: gidNum(node.id),
    name: node.name,
    order_number: node.name,
    email: node.email ?? node.customer?.email ?? null,
    financial_status: node.displayFinancialStatus?.toLowerCase(),
    fulfillment_status: node.displayFulfillmentStatus?.toLowerCase() ?? null,
    processed_at: node.processedAt ?? node.createdAt,
    created_at: node.createdAt,
    cancelled_at: node.cancelledAt ?? null,
    note_attributes: (node.customAttributes ?? []).map((a) => ({
      name: a.key,
      value: a.value,
    })),
    customer: node.customer
      ? {
          id: gidNum(node.customer.id),
          email: node.customer.email ?? undefined,
          first_name: node.customer.firstName ?? undefined,
          last_name: node.customer.lastName ?? undefined,
          phone: node.customer.phone ?? undefined,
        }
      : null,
    line_items: node.lineItems.edges.map((e) => {
      const item = e.node;
      const amount = item.originalUnitPriceSet?.shopMoney?.amount;
      return {
        id: gidNum(item.id)!,
        product_id: gidNum(item.product?.id ?? null),
        variant_id: gidNum(item.variant?.id ?? null),
        title: item.title,
        name: item.name ?? item.title,
        sku: item.sku,
        quantity: item.quantity,
        price: amount,
        properties: (item.customAttributes ?? []).map((a) => ({
          name: a.key,
          value: a.value,
        })),
      };
    }),
    fulfillments: (node.fulfillments ?? []).map((f) => ({
      created_at: f.createdAt,
      status: f.status,
    })),
  };
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Pull recent orders via Admin API and create warranties (works without PCD webhooks). */
export async function syncRecentOrdersForShop(params: {
  shopId: string;
  shopDomain: string;
  lookbackDays?: number;
  maxPages?: number;
  /** When true (default), create warranties even if checkout opt-in attribute was lost. */
  forceOptIn?: boolean;
}) {
  const lookbackDays = params.lookbackDays ?? 14;
  const maxPages = params.maxPages ?? 4;
  const forceOptIn = params.forceOptIn !== false;
  const query = `created_at:>=${daysAgoIso(lookbackDays)}`;

  let cursor: string | null = null;
  let processed = 0;

  const countBefore = await prisma.warranty.count({ where: { shopId: params.shopId } });

  for (let page = 0; page < maxPages; page++) {
    // Explicit annotation breaks TS7022 circular inference (cursor ↔ data in the loop).
    const data: OrdersPageResult = await shopifyGraphqlRequest<OrdersPageResult>(
      params.shopDomain,
      ORDERS_RECENT_QUERY,
      { cursor, query },
    );

    for (const edge of data.orders.edges) {
      const payload = graphqlOrderToWebhookPayload(edge.node);
      // Without PCD webhooks, cart checkbox attrs often never arrive — still create coverage
      // for ordered products that match warranty rules.
      if (forceOptIn) ensureOptInAttribute(payload);
      await syncOrderFromWebhook(params.shopId, payload);
      processed++;
    }

    if (!data.orders.pageInfo.hasNextPage) break;
    cursor = data.orders.pageInfo.endCursor;
    if (!cursor) break;
  }

  const countAfter = await prisma.warranty.count({ where: { shopId: params.shopId } });

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "system",
      action: "orders.auto_sync",
      entityType: "shop",
      entityId: params.shopId,
      meta: {
        processedOrders: processed,
        warrantiesCreatedApprox: Math.max(0, countAfter - countBefore),
        lookbackDays,
      },
    },
  });

  return {
    processedOrders: processed,
    warrantiesCreatedApprox: Math.max(0, countAfter - countBefore),
    lookbackDays,
  };
}

/** Throttled sync used when merchant opens the app (no PCD webhooks required). */
export async function maybeAutoSyncRecentOrders(params: {
  shopId: string;
  shopDomain: string;
  minIntervalMs?: number;
  lookbackDays?: number;
}) {
  const minIntervalMs = params.minIntervalMs ?? 3 * 60 * 1000;
  const last = await prisma.activityLog.findFirst({
    where: { shopId: params.shopId, action: "orders.auto_sync" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < minIntervalMs) {
    return { skipped: true as const, reason: "throttled" };
  }
  try {
    const result = await syncRecentOrdersForShop({
      shopId: params.shopId,
      shopDomain: params.shopDomain,
      lookbackDays: params.lookbackDays ?? 7,
      maxPages: 2,
      forceOptIn: true,
    });
    return { skipped: false as const, ...result };
  } catch (err) {
    await prisma.activityLog.create({
      data: {
        shopId: params.shopId,
        actorType: "system",
        action: "orders.auto_sync_failed",
        entityType: "shop",
        entityId: params.shopId,
        meta: { error: err instanceof Error ? err.message : String(err) },
      },
    });
    return {
      skipped: true as const,
      reason: err instanceof Error ? err.message : "sync_failed",
    };
  }
}

/** Sync one order by Shopify GID or order name (e.g. #1001). */
export async function syncOneOrderForShop(params: {
  shopId: string;
  shopDomain: string;
  orderGid?: string | null;
  orderName?: string | null;
}) {
  let node: GqlOrderNode | null = null;

  if (params.orderGid) {
    const gid = params.orderGid.startsWith("gid://")
      ? params.orderGid
      : `gid://shopify/Order/${params.orderGid.replace(/\D/g, "")}`;
    const data = await shopifyGraphqlRequest<{ order: GqlOrderNode | null }>(
      params.shopDomain,
      ORDER_BY_ID_QUERY,
      { id: gid },
    );
    node = data.order;
  } else if (params.orderName) {
    const name = params.orderName.trim().startsWith("#")
      ? params.orderName.trim()
      : `#${params.orderName.trim()}`;
    const data = await shopifyGraphqlRequest<{
      orders: { edges: Array<{ node: GqlOrderNode }> };
    }>(params.shopDomain, ORDER_BY_NAME_QUERY, { query: `name:${name}` });
    node = data.orders.edges[0]?.node ?? null;
  }

  if (!node) return { ok: false as const, reason: "order_not_found" };

  const payload = graphqlOrderToWebhookPayload(node);
  ensureOptInAttribute(payload);
  const order = await syncOrderFromWebhook(params.shopId, payload);
  return { ok: true as const, orderId: order?.id ?? null, orderNumber: node.name };
}

function ensureOptInAttribute(payload: ReturnType<typeof graphqlOrderToWebhookPayload>) {
  const notes = payload.note_attributes ?? [];
  if (notes.some((a) => a.name === "aftersale_register_intent")) return;
  payload.note_attributes = [...notes, { name: "aftersale_register_intent", value: "yes" }];
}
