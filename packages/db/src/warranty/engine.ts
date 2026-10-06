import { prisma } from "../client";
import {
  buildWarrantyDates,
  randomCertificateToken,
  selectRulesByType,
  unitsToVoidOnRefund,
  type MatchableRule,
  type StartDateRuleKind,
} from "@aftersale/shared";
import { usageRepository } from "../repositories";
import { assertMonthlyQuota } from "../plan-limits";

export async function loadMatchableRules(shopId: string): Promise<MatchableRule[]> {
  const rules = await prisma.warrantyRule.findMany({
    where: { shopId, active: true },
    include: {
      versions: { orderBy: { version: "desc" } },
      assignments: true,
    },
  });

  const out: MatchableRule[] = [];
  for (const rule of rules) {
    const version =
      (rule.currentVersionId
        ? rule.versions.find((v) => v.id === rule.currentVersionId)
        : null) ?? rule.versions[0];
    if (!version) continue;
    for (const a of rule.assignments) {
      out.push({
        ruleId: rule.id,
        ruleVersionId: version.id,
        warrantyType: version.warrantyType,
        priority: rule.priority,
        targetType: a.targetType as MatchableRule["targetType"],
        targetId: a.targetId,
        durationMonths: version.durationMonths,
        startDateRule: version.startDateRule as StartDateRuleKind,
        gracePeriodDays: version.gracePeriodDays,
      });
    }
  }
  return out;
}

export async function ensureWarrantyUnitsForLineItem(params: {
  shopId: string;
  orderLineItemId: string;
  quantity: number;
}) {
  const existing = await prisma.warrantyUnit.findMany({
    where: { shopId: params.shopId, orderLineItemId: params.orderLineItemId },
    orderBy: { unitIndex: "asc" },
  });
  const created = [...existing];
  for (let i = 0; i < params.quantity; i++) {
    if (existing.some((u) => u.unitIndex === i)) continue;
    const unit = await prisma.warrantyUnit.create({
      data: {
        shopId: params.shopId,
        orderLineItemId: params.orderLineItemId,
        unitIndex: i,
        status: "ACTIVE",
      },
    });
    created.push(unit);
  }
  return created.sort((a, b) => a.unitIndex - b.unitIndex);
}

export async function createWarrantiesForOrderLine(params: {
  shopId: string;
  orderId: string;
  orderLineItemId: string;
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
  collectionIds?: string[];
  quantity: number;
  customerId?: string | null;
  purchaseAt?: Date | null;
  fulfilledAt?: Date | null;
  deliveredAt?: Date | null;
  timeZone: string;
  source?: "ORDER" | "BACKFILL" | "MANUAL";
  skipUsageIncrement?: boolean;
}) {
  const units = await ensureWarrantyUnitsForLineItem({
    shopId: params.shopId,
    orderLineItemId: params.orderLineItemId,
    quantity: params.quantity,
  });

  const rules = await loadMatchableRules(params.shopId);
  const winners = selectRulesByType(rules, {
    shopifyProductId: params.shopifyProductId,
    shopifyVariantId: params.shopifyVariantId,
    collectionIds: params.collectionIds,
  });

  if (winners.length === 0) {
    return { units, warranties: [] as Awaited<ReturnType<typeof prisma.warranty.create>>[] };
  }

  const createdWarranties = [];
  for (const unit of units) {
    if (unit.status === "VOID") continue;
    for (const winner of winners) {
      const existing = await prisma.warranty.findFirst({
        where: {
          shopId: params.shopId,
          warrantyUnitId: unit.id,
          ruleVersionId: winner.ruleVersionId,
          status: { not: "VOID" },
        },
      });
      if (existing) continue;

      const dates = buildWarrantyDates({
        startDateRule: winner.startDateRule,
        durationMonths: winner.durationMonths,
        timeZone: params.timeZone,
        purchaseAt: params.purchaseAt,
        fulfilledAt: params.fulfilledAt,
        deliveredAt: params.deliveredAt,
      });

      const warranty = await prisma.warranty.create({
        data: {
          shopId: params.shopId,
          warrantyUnitId: unit.id,
          customerId: params.customerId ?? undefined,
          ruleVersionId: winner.ruleVersionId,
          source: params.source ?? "ORDER",
          status: dates.status,
          startAt: dates.startAt,
          endAt: dates.endAt,
          timezone: params.timeZone,
          certificateToken: randomCertificateToken(),
        },
      });
      createdWarranties.push(warranty);

      if (!params.skipUsageIncrement) {
        await usageRepository.increment(params.shopId, "warranties_created");
      }

      await prisma.activityLog.create({
        data: {
          shopId: params.shopId,
          actorType: "system",
          action: "warranty.created",
          entityType: "warranty",
          entityId: warranty.id,
          after: {
            unitId: unit.id,
            ruleVersionId: winner.ruleVersionId,
            status: warranty.status,
            source: warranty.source,
          },
        },
      });
    }
  }

  return { units, warranties: createdWarranties };
}

/** Recompute start/end/status when fulfillment arrives. */
export async function refreshWarrantiesForOrder(shopId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    include: {
      lineItems: { include: { warrantyUnits: { include: { warranties: true } } } },
    },
  });
  if (!order) return;

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });

  for (const line of order.lineItems) {
    for (const unit of line.warrantyUnits) {
      for (const w of unit.warranties) {
        if (w.status === "VOID") continue;
        const version = await prisma.warrantyRuleVersion.findUnique({ where: { id: w.ruleVersionId } });
        if (!version) continue;
        const dates = buildWarrantyDates({
          startDateRule: version.startDateRule as StartDateRuleKind,
          durationMonths: version.durationMonths,
          timeZone: shop.timezone || w.timezone || "UTC",
          purchaseAt: order.processedAt ?? order.createdAt,
          fulfilledAt: order.fulfilledAt,
          deliveredAt: order.deliveredAt,
        });
        if (
          dates.status !== w.status ||
          dates.startAt?.getTime() !== w.startAt?.getTime() ||
          dates.endAt?.getTime() !== w.endAt?.getTime()
        ) {
          await prisma.warranty.update({
            where: { id: w.id },
            data: {
              status: dates.status,
              startAt: dates.startAt,
              endAt: dates.endAt,
            },
          });
        }
      }
    }
  }
}

export async function voidWarrantiesOnCancel(shopId: string, orderId: string, reason: string) {
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
  if (!shop.voidWarrantyOnRefund) return { voided: 0 };

  const lines = await prisma.orderLineItem.findMany({
    where: { shopId, orderId },
    include: { warrantyUnits: { include: { warranties: true } } },
  });

  let voided = 0;
  for (const line of lines) {
    for (const unit of line.warrantyUnits) {
      if (unit.status === "VOID") continue;
      await prisma.warrantyUnit.update({
        where: { id: unit.id },
        data: { status: "VOID" },
      });
      for (const w of unit.warranties) {
        if (w.status === "VOID") continue;
        await prisma.warranty.update({
          where: { id: w.id },
          data: { status: "VOID", voidReason: reason },
        });
        voided++;
        await prisma.activityLog.create({
          data: {
            shopId,
            actorType: "system",
            action: "warranty.voided",
            entityType: "warranty",
            entityId: w.id,
            before: { status: w.status },
            after: { status: "VOID", reason },
          },
        });
      }
    }
  }
  return { voided };
}

export async function voidWarrantiesOnRefund(params: {
  shopId: string;
  shopifyOrderId: string;
  refundLineItems: { shopifyLineItemId: string; quantity: number }[];
  reason?: string;
}) {
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: params.shopId } });
  if (!shop.voidWarrantyOnRefund) return { voided: 0 };

  const order = await prisma.order.findUnique({
    where: {
      shopId_shopifyOrderId: { shopId: params.shopId, shopifyOrderId: params.shopifyOrderId },
    },
  });
  if (!order) return { voided: 0 };

  let voided = 0;
  const reason = params.reason ?? "refund";

  for (const refund of params.refundLineItems) {
    const line = await prisma.orderLineItem.findUnique({
      where: {
        shopId_shopifyLineItemId: {
          shopId: params.shopId,
          shopifyLineItemId: refund.shopifyLineItemId,
        },
      },
      include: {
        warrantyUnits: {
          orderBy: { unitIndex: "desc" },
          include: { warranties: true },
        },
      },
    });
    if (!line) continue;

    const alreadyVoided = line.warrantyUnits.filter((u) => u.status === "VOID").length;
    const toVoid = unitsToVoidOnRefund({
      lineQuantity: line.quantity,
      alreadyVoidedUnits: alreadyVoided,
      refundQuantity: refund.quantity,
    });

    const activeUnits = line.warrantyUnits.filter((u) => u.status !== "VOID");
    for (let i = 0; i < toVoid; i++) {
      const unit = activeUnits[i];
      if (!unit) break;
      await prisma.warrantyUnit.update({ where: { id: unit.id }, data: { status: "VOID" } });
      for (const w of unit.warranties) {
        if (w.status === "VOID") continue;
        await prisma.warranty.update({
          where: { id: w.id },
          data: { status: "VOID", voidReason: reason },
        });
        voided++;
        await prisma.activityLog.create({
          data: {
            shopId: params.shopId,
            actorType: "system",
            action: "warranty.voided",
            entityType: "warranty",
            entityId: w.id,
            before: { status: w.status },
            after: { status: "VOID", reason },
          },
        });
      }
    }
  }

  return { voided };
}

export async function createManualWarranty(params: {
  shopId: string;
  customerEmail?: string;
  productTitle: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  serialNumber?: string;
  ruleId: string;
  purchaseAt: Date;
  startAt?: Date;
  reason: string;
  actorId?: string;
}) {
  await assertMonthlyQuota(params.shopId, "warranties_created");

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: params.shopId } });
  const rule = await prisma.warrantyRule.findFirst({
    where: { id: params.ruleId, shopId: params.shopId },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!rule) throw new Error("Rule not found");
  const version =
    (rule.currentVersionId
      ? rule.versions.find((v) => v.id === rule.currentVersionId)
      : null) ?? rule.versions[0];
  if (!version) throw new Error("Rule has no version");

  let customerId: string | undefined;
  if (params.customerEmail) {
    const customer = await prisma.customer.upsert({
      where: {
        shopId_shopifyCustomerId: {
          shopId: params.shopId,
          shopifyCustomerId: `manual:${params.customerEmail.toLowerCase()}`,
        },
      },
      create: {
        shopId: params.shopId,
        shopifyCustomerId: `manual:${params.customerEmail.toLowerCase()}`,
        email: params.customerEmail.toLowerCase(),
      },
      update: { email: params.customerEmail.toLowerCase() },
    });
    customerId = customer.id;
  }

  // Synthetic order/line for manual warranties
  const order = await prisma.order.create({
    data: {
      shopId: params.shopId,
      shopifyOrderId: `manual_${Date.now()}`,
      orderNumber: `MANUAL-${Date.now()}`,
      customerId,
      email: params.customerEmail?.toLowerCase(),
      processedAt: params.purchaseAt,
      fulfilledAt: params.startAt ?? params.purchaseAt,
      currency: shop.currency,
    },
  });

  const line = await prisma.orderLineItem.create({
    data: {
      shopId: params.shopId,
      orderId: order.id,
      shopifyLineItemId: `manual_line_${Date.now()}`,
      shopifyProductId: params.shopifyProductId,
      shopifyVariantId: params.shopifyVariantId,
      title: params.productTitle,
      quantity: 1,
    },
  });

  const unit = await prisma.warrantyUnit.create({
    data: {
      shopId: params.shopId,
      orderLineItemId: line.id,
      unitIndex: 0,
      serialNumber: params.serialNumber,
      status: "ACTIVE",
    },
  });

  const dates = buildWarrantyDates({
    startDateRule: version.startDateRule as StartDateRuleKind,
    durationMonths: version.durationMonths,
    timeZone: shop.timezone,
    purchaseAt: params.purchaseAt,
    fulfilledAt: params.startAt ?? params.purchaseAt,
    fixedAt: params.startAt,
  });

  const warranty = await prisma.warranty.create({
    data: {
      shopId: params.shopId,
      warrantyUnitId: unit.id,
      customerId,
      ruleVersionId: version.id,
      source: "MANUAL",
      status: dates.status,
      startAt: dates.startAt,
      endAt: dates.endAt,
      timezone: shop.timezone,
      certificateToken: randomCertificateToken(),
    },
  });

  await usageRepository.increment(params.shopId, "warranties_created");
  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      actorId: params.actorId,
      action: "warranty.manual_created",
      entityType: "warranty",
      entityId: warranty.id,
      after: { reason: params.reason },
    },
  });

  return warranty;
}
