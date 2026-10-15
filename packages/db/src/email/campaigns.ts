import { prisma } from "../client";
import { sendTransactionalEmail } from "./send";

export type ExpiryCampaignResult = {
  matched: number;
  sent: number;
  skipped: number;
  errors: number;
};

/**
 * Email customers whose warranties expire within `daysAhead` days.
 * Marketing / retention use-case (plan feature: expiryCampaigns).
 */
export async function runWarrantyExpiryCampaign(params: {
  shopId: string;
  daysAhead?: number;
  dryRun?: boolean;
}): Promise<ExpiryCampaignResult> {
  const daysAhead = Math.min(90, Math.max(1, params.daysAhead ?? 30));
  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: params.shopId } });
  const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  const warranties = await prisma.warranty.findMany({
    where: {
      shopId: params.shopId,
      status: { in: ["ACTIVE", "EXPIRING_SOON"] },
      endAt: { gte: now, lte: until },
    },
    include: {
      customer: true,
      warrantyUnit: {
        include: {
          orderLineItem: { include: { order: true } },
        },
      },
      ruleVersion: { include: { rule: true } },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const w of warranties) {
    const email =
      w.customer?.email?.toLowerCase() ||
      w.warrantyUnit.orderLineItem.order.email?.toLowerCase() ||
      null;
    if (!email || !email.includes("@")) {
      skipped++;
      continue;
    }

    const productTitle = w.warrantyUnit.orderLineItem.title;
    const orderNumber = w.warrantyUnit.orderLineItem.order.orderNumber;
    const endAt = w.endAt ? w.endAt.toISOString().slice(0, 10) : "";
    const portalLink = `${appUrl}/apps/aftersale/portal?shop=${encodeURIComponent(shop.shopDomain)}&email=${encodeURIComponent(email)}`;
    const claimLink = `${appUrl}/apps/aftersale/claim?shop=${encodeURIComponent(shop.shopDomain)}&certificate=${encodeURIComponent(w.certificateToken)}`;

    if (params.dryRun) {
      skipped++;
      continue;
    }

    try {
      const result = await sendTransactionalEmail({
        shopId: params.shopId,
        to: email,
        template: "warranty_expiring",
        data: {
          shopName: shop.shopName ?? shop.shopDomain,
          productTitle,
          orderNumber,
          endAt,
          daysAhead: String(daysAhead),
          link: portalLink,
          claimLink,
          ruleName: w.ruleVersion.rule.name,
        },
      });
      if (result.sent) sent++;
      else skipped++;
    } catch {
      errors++;
    }
  }

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      action: "campaign.expiry_run",
      entityType: "shop",
      entityId: params.shopId,
      meta: {
        daysAhead,
        matched: warranties.length,
        sent,
        skipped,
        errors,
        dryRun: Boolean(params.dryRun),
      },
    },
  });

  return { matched: warranties.length, sent, skipped, errors };
}

/** One-off marketing email to customers with active warranties. */
export async function runMarketingBroadcast(params: {
  shopId: string;
  subject: string;
  bodyHtml: string;
  dryRun?: boolean;
  limit?: number;
}): Promise<ExpiryCampaignResult> {
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: params.shopId } });
  const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  const warranties = await prisma.warranty.findMany({
    where: {
      shopId: params.shopId,
      status: { in: ["ACTIVE", "EXPIRING_SOON"] },
    },
    include: {
      customer: true,
      warrantyUnit: { include: { orderLineItem: { include: { order: true } } } },
    },
    take: params.limit ?? 200,
    orderBy: { createdAt: "desc" },
  });

  const seen = new Set<string>();
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let matched = 0;

  for (const w of warranties) {
    const email =
      w.customer?.email?.toLowerCase() ||
      w.warrantyUnit.orderLineItem.order.email?.toLowerCase() ||
      null;
    if (!email || !email.includes("@") || seen.has(email)) {
      if (email && seen.has(email)) continue;
      skipped++;
      continue;
    }
    seen.add(email);
    matched++;

    const portalLink = `${appUrl}/apps/aftersale/portal?shop=${encodeURIComponent(shop.shopDomain)}&email=${encodeURIComponent(email)}`;
    if (params.dryRun) {
      skipped++;
      continue;
    }

    try {
      const result = await sendTransactionalEmail({
        shopId: params.shopId,
        to: email,
        template: "marketing_broadcast",
        data: {
          shopName: shop.shopName ?? shop.shopDomain,
          subject: params.subject,
          bodyHtml: params.bodyHtml,
          link: portalLink,
          productTitle: w.warrantyUnit.orderLineItem.title,
        },
      });
      if (result.sent) sent++;
      else skipped++;
    } catch {
      errors++;
    }
  }

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      action: "campaign.marketing_broadcast",
      entityType: "shop",
      entityId: params.shopId,
      meta: { matched, sent, skipped, errors, dryRun: Boolean(params.dryRun) },
    },
  });

  return { matched, sent, skipped, errors };
}
