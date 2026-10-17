import { prisma } from "../client";
import { canConsumeMonthlyQuota } from "../plan-limits";
import { createWarrantiesForOrderLine, refreshWarrantiesForOrder, voidWarrantiesOnCancel } from "./engine";
import { approveAwaitingFeeRegistrations } from "./registration";

type ShopifyOrderPayload = {
  id: number | string;
  admin_graphql_api_id?: string;
  name?: string;
  order_number?: number | string;
  email?: string | null;
  currency?: string;
  financial_status?: string;
  fulfillment_status?: string | null;
  processed_at?: string | null;
  created_at?: string;
  cancelled_at?: string | null;
  note_attributes?: Array<{ name?: string; value?: string }>;
  attributes?: Record<string, string> | Array<{ name?: string; value?: string }>;
  customer?: {
    id?: number | string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  } | null;
  line_items?: Array<{
    id: number | string;
    product_id?: number | string | null;
    variant_id?: number | string | null;
    title?: string;
    name?: string;
    sku?: string | null;
    quantity: number;
    price?: string;
    properties?: Array<{ name?: string; value?: string }>;
  }>;
  fulfillments?: Array<{ created_at?: string; status?: string }>;
};

function attrYes(
  notes: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): boolean {
  return (notes ?? []).some(
    (n) => n?.name === name && String(n.value ?? "").toLowerCase() === "yes",
  );
}

function attrValue(
  notes: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string | null {
  const hit = (notes ?? []).find((n) => n?.name === name && n.value != null && String(n.value) !== "");
  return hit?.value != null ? String(hit.value) : null;
}

function orderAttr(order: ShopifyOrderPayload, name: string): string | null {
  const fromNotes = attrValue(order.note_attributes, name);
  if (fromNotes) return fromNotes;
  if (order.attributes && !Array.isArray(order.attributes)) {
    const v = order.attributes[name];
    return v != null && String(v) !== "" ? String(v) : null;
  }
  if (Array.isArray(order.attributes)) return attrValue(order.attributes, name);
  for (const item of order.line_items ?? []) {
    const fromProps = attrValue(item.properties, name) || attrValue(item.properties, `_${name}`);
    if (fromProps) return fromProps;
  }
  return null;
}

function orderWantsWarrantyRegistration(order: ShopifyOrderPayload): boolean {
  if (attrYes(order.note_attributes, "aftersale_register_intent")) return true;
  if (order.attributes && !Array.isArray(order.attributes)) {
    return String(order.attributes.aftersale_register_intent ?? "").toLowerCase() === "yes";
  }
  if (Array.isArray(order.attributes)) {
    return attrYes(order.attributes, "aftersale_register_intent");
  }
  // Line-item property set from PDP opt-in (product-scoped).
  for (const item of order.line_items ?? []) {
    if (attrYes(item.properties, "_aftersale_register") || attrYes(item.properties, "aftersale_register")) {
      return true;
    }
  }
  return false;
}

function orderHasWarrantyFeeLine(order: ShopifyOrderPayload, feeVariantId: string | null | undefined): boolean {
  if (!feeVariantId) return false;
  const want = feeVariantId.replace(/\D/g, "");
  for (const item of order.line_items ?? []) {
    const vid = String(item.variant_id ?? "").replace(/\D/g, "");
    if (vid && vid === want) return true;
    if (attrYes(item.properties, "_aftersale_warranty_fee")) return true;
  }
  return false;
}

function isFeeLineItem(
  item: NonNullable<ShopifyOrderPayload["line_items"]>[number],
  feeVariantId: string | null | undefined,
): boolean {
  if (attrYes(item.properties, "_aftersale_warranty_fee")) return true;
  if (!feeVariantId) return false;
  const want = feeVariantId.replace(/\D/g, "");
  const vid = String(item.variant_id ?? "").replace(/\D/g, "");
  return Boolean(want && vid && want === vid);
}

function gidNum(id: number | string | null | undefined): string | null {
  if (id == null) return null;
  return String(id);
}

export async function syncOrderFromWebhook(shopId: string, payload: unknown) {
  const order = payload as ShopifyOrderPayload;
  const shopifyOrderId = gidNum(order.id);
  if (!shopifyOrderId) return null;

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });

  let customerId: string | undefined;
  if (order.customer?.id || order.customer?.email || order.email) {
    const shopifyCustomerId = order.customer?.id
      ? String(order.customer.id)
      : `email:${(order.customer?.email ?? order.email)!.toLowerCase()}`;
    const customer = await prisma.customer.upsert({
      where: { shopId_shopifyCustomerId: { shopId, shopifyCustomerId } },
      create: {
        shopId,
        shopifyCustomerId,
        email: (order.customer?.email ?? order.email ?? undefined)?.toLowerCase(),
        firstName: order.customer?.first_name,
        lastName: order.customer?.last_name,
        phone: order.customer?.phone,
      },
      update: {
        email: (order.customer?.email ?? order.email ?? undefined)?.toLowerCase(),
        firstName: order.customer?.first_name,
        lastName: order.customer?.last_name,
        phone: order.customer?.phone,
      },
    });
    customerId = customer.id;
  }

  const fulfilledAt =
    order.fulfillment_status === "fulfilled" || order.fulfillment_status === "partial"
      ? order.fulfillments?.[0]?.created_at
        ? new Date(order.fulfillments[0].created_at)
        : order.processed_at
          ? new Date(order.processed_at)
          : new Date()
      : null;

  const orderNumber = String(order.name ?? order.order_number ?? shopifyOrderId);
  const optedIn = orderWantsWarrantyRegistration(order);
  const paidFee = orderHasWarrantyFeeLine(order, shop.warrantyFeeVariantId);
  const shouldCreateWarranties =
    !shop.warrantyOptInRequired || optedIn || paidFee;

  const dbOrder = await prisma.order.upsert({
    where: { shopId_shopifyOrderId: { shopId, shopifyOrderId } },
    create: {
      shopId,
      shopifyOrderId,
      orderNumber,
      customerId,
      email: order.email?.toLowerCase() ?? undefined,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status ?? undefined,
      processedAt: order.processed_at ? new Date(order.processed_at) : undefined,
      fulfilledAt: fulfilledAt ?? undefined,
      cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : undefined,
      currency: order.currency ?? shop.currency,
    },
    update: {
      customerId,
      email: order.email?.toLowerCase() ?? undefined,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status ?? undefined,
      processedAt: order.processed_at ? new Date(order.processed_at) : undefined,
      fulfilledAt: fulfilledAt ?? undefined,
      cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : undefined,
    },
  });

  let warrantiesCreated = 0;
  let skippedQuota = false;

  for (const item of order.line_items ?? []) {
    const shopifyLineItemId = String(item.id);
    const shopifyProductId = gidNum(item.product_id);
    const shopifyVariantId = gidNum(item.variant_id);
    const priceCents = item.price ? Math.round(parseFloat(item.price) * 100) : null;

    let productVariantId: string | undefined;
    let collectionIds: string[] = [];
    if (shopifyProductId) {
      const product = await prisma.product.findUnique({
        where: { shopId_shopifyProductId: { shopId, shopifyProductId } },
      });
      if (product) collectionIds = product.collectionIds;
    }
    if (shopifyVariantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { shopId_shopifyVariantId: { shopId, shopifyVariantId } },
      });
      productVariantId = variant?.id;
    }

    const line = await prisma.orderLineItem.upsert({
      where: { shopId_shopifyLineItemId: { shopId, shopifyLineItemId } },
      create: {
        shopId,
        orderId: dbOrder.id,
        shopifyLineItemId,
        productVariantId,
        shopifyProductId: shopifyProductId ?? undefined,
        shopifyVariantId: shopifyVariantId ?? undefined,
        title: item.title ?? item.name ?? "Item",
        sku: item.sku ?? undefined,
        quantity: item.quantity,
        priceCents: priceCents ?? undefined,
      },
      update: {
        productVariantId,
        title: item.title ?? item.name ?? "Item",
        sku: item.sku ?? undefined,
        quantity: item.quantity,
        priceCents: priceCents ?? undefined,
      },
    });

    // Never create coverage on the warranty-fee product itself.
    if (isFeeLineItem(item, shop.warrantyFeeVariantId)) continue;

    if (!shouldCreateWarranties) continue;

    const quota = await canConsumeMonthlyQuota(
      shopId,
      "warranties_created",
      Math.max(1, item.quantity || 1),
    );
    if (!quota.ok) {
      skippedQuota = true;
      continue;
    }

    const { warranties } = await createWarrantiesForOrderLine({
      shopId,
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
      source: "ORDER",
    });
    warrantiesCreated += warranties.length;
  }

  // Portal “pay then activate”: fee checkout carries aftersale_registration_id.
  if (paidFee || optedIn) {
    const registrationId =
      orderAttr(order, "aftersale_registration_id") ||
      orderAttr(order, "_aftersale_registration_id");
    try {
      await approveAwaitingFeeRegistrations({
        shopId,
        email: dbOrder.email,
        registrationId,
      });
    } catch (err) {
      console.warn("approveAwaitingFeeRegistrations", err);
    }
  }

  if (optedIn || paidFee) {
    await prisma.activityLog.create({
      data: {
        shopId,
        actorType: "customer",
        action: "warranty.opt_in_checkout",
        entityType: "order",
        entityId: dbOrder.id,
        meta: {
          orderNumber: dbOrder.orderNumber,
          email: dbOrder.email,
          source: paidFee ? "warranty_fee" : "aftersale_register_intent",
          warrantiesCreated,
          skippedQuota,
          optInRequired: shop.warrantyOptInRequired,
        },
      },
    });
  } else if (shop.warrantyOptInRequired) {
    await prisma.activityLog.create({
      data: {
        shopId,
        actorType: "system",
        action: "warranty.opt_in_skipped",
        entityType: "order",
        entityId: dbOrder.id,
        meta: {
          orderNumber: dbOrder.orderNumber,
          reason: "no_checkout_opt_in",
        },
      },
    });
  }

  if (skippedQuota) {
    await prisma.activityLog.create({
      data: {
        shopId,
        actorType: "system",
        action: "warranty.quota_skipped",
        entityType: "order",
        entityId: dbOrder.id,
        meta: { orderNumber: dbOrder.orderNumber, warrantiesCreated },
      },
    });
  }

  if (dbOrder.cancelledAt) {
    await voidWarrantiesOnCancel(shopId, dbOrder.id, "order_cancelled");
  } else {
    await refreshWarrantiesForOrder(shopId, dbOrder.id);
  }

  return dbOrder;
}

export async function syncProductFromWebhook(shopId: string, payload: unknown) {
  const p = payload as {
    id: number | string;
    title?: string;
    handle?: string;
    status?: string;
    vendor?: string;
    product_type?: string;
    image?: { src?: string };
    variants?: Array<{
      id: number | string;
      title?: string;
      sku?: string;
      barcode?: string;
      price?: string;
    }>;
  };

  const shopifyProductId = String(p.id);
  const product = await prisma.product.upsert({
    where: { shopId_shopifyProductId: { shopId, shopifyProductId } },
    create: {
      shopId,
      shopifyProductId,
      title: p.title ?? "Product",
      handle: p.handle,
      status: p.status,
      vendor: p.vendor,
      productType: p.product_type,
      imageUrl: p.image?.src,
      syncedAt: new Date(),
    },
    update: {
      title: p.title ?? "Product",
      handle: p.handle,
      status: p.status,
      vendor: p.vendor,
      productType: p.product_type,
      imageUrl: p.image?.src,
      syncedAt: new Date(),
    },
  });

  for (const v of p.variants ?? []) {
    await prisma.productVariant.upsert({
      where: { shopId_shopifyVariantId: { shopId, shopifyVariantId: String(v.id) } },
      create: {
        shopId,
        productId: product.id,
        shopifyVariantId: String(v.id),
        title: v.title ?? "Default",
        sku: v.sku,
        barcode: v.barcode,
        priceCents: v.price ? Math.round(parseFloat(v.price) * 100) : undefined,
      },
      update: {
        productId: product.id,
        title: v.title ?? "Default",
        sku: v.sku,
        barcode: v.barcode,
        priceCents: v.price ? Math.round(parseFloat(v.price) * 100) : undefined,
      },
    });
  }

  return product;
}
