import { prisma } from "./client";
import { usageRepository } from "./repositories";
import type { Plan } from "@prisma/client";

export class PlanLimitError extends Error {
  readonly code = "PLAN_LIMIT" as const;
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export type MonthlyMetric = "warranties_created" | "claims_created" | "ai_credits";

export type PlanFeatureFlag =
  | "publicApiEnabled"
  | "customBranding"
  | "pdfCertificate"
  | "qrCodes"
  | "csvExport"
  | "backfillBeyond12Months"
  | "repairsEnabled"
  | "customWorkflows"
  | "advancedAnalytics"
  | "flowEnabled"
  | "expiryCampaigns"
  | "bulkOperations"
  | "supplierPortal"
  | "technicianPortal"
  | "partsInventory"
  | "multiLocation"
  | "erpConnectors";

const METRIC_LIMIT_FIELD: Record<MonthlyMetric, keyof Plan> = {
  warranties_created: "warrantiesPerMonth",
  claims_created: "claimsPerMonth",
  ai_credits: "aiCreditsPerMonth",
};

const METRIC_LABEL: Record<MonthlyMetric, string> = {
  warranties_created: "warranties",
  claims_created: "claims",
  ai_credits: "AI credits",
};

export async function getShopWithPlan(shopId: string) {
  return prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
    include: { plan: true },
  });
}

/** Blocks merchant app use until a plan is chosen (billing bypass allowed). */
export async function assertShopHasPlan(shopId: string): Promise<Plan | null> {
  const shop = await getShopWithPlan(shopId);
  if (shop.billingBypass) return shop.plan;
  if (!shop.planId || !shop.plan) {
    throw new PlanLimitError("Choose a plan to unlock AfterSale OS features.");
  }
  return shop.plan;
}

export async function assertPlanFeature(shopId: string, feature: PlanFeatureFlag, label?: string) {
  const plan = await assertShopHasPlan(shopId);
  if (!plan) return; // billing bypass without plan row
  if (!plan[feature]) {
    throw new PlanLimitError(
      `${label ?? feature} is not included on your ${plan.name} plan. Upgrade to enable it.`,
    );
  }
}

/** Hard stop for merchant-initiated monthly quotas from the Plan row (admin-editable). */
export async function assertMonthlyQuota(shopId: string, metric: MonthlyMetric) {
  const plan = await assertShopHasPlan(shopId);
  if (!plan) return;

  const limit = Number(plan[METRIC_LIMIT_FIELD[metric]] ?? 0);
  if (limit <= 0) {
    throw new PlanLimitError(
      `${METRIC_LABEL[metric]} are not available on your ${plan.name} plan. Upgrade to continue.`,
    );
  }

  const used = await usageRepository.getCount(shopId, metric);
  if (used >= limit) {
    throw new PlanLimitError(
      `Monthly ${METRIC_LABEL[metric]} limit reached (${used}/${limit} on ${plan.name}). Upgrade your plan or wait until next month.`,
    );
  }
}

export async function remainingMonthlyQuota(shopId: string, metric: MonthlyMetric) {
  const shop = await getShopWithPlan(shopId);
  const plan = shop.plan;
  if (!plan) return { used: 0, limit: 0, remaining: 0 };
  const limit = Number(plan[METRIC_LIMIT_FIELD[metric]] ?? 0);
  const used = await usageRepository.getCount(shopId, metric);
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export async function assertWarrantyRulesQuota(shopId: string) {
  const plan = await assertShopHasPlan(shopId);
  if (!plan) return;

  const count = await prisma.warrantyRule.count({ where: { shopId } });
  if (count >= plan.warrantyRulesLimit) {
    throw new PlanLimitError(
      `Warranty rules limit reached (${count}/${plan.warrantyRulesLimit} on ${plan.name}). Upgrade to add more rules.`,
    );
  }
}

/** lookbackMonths: 12 | 24 | 0 (all). Beyond 12 requires plan flag. */
export async function assertBackfillLookback(shopId: string, lookbackMonths: number) {
  await assertShopHasPlan(shopId);
  if (![12, 24, 0].includes(lookbackMonths)) {
    throw new PlanLimitError("Lookback must be 12 months, 24 months, or all available.");
  }
  if (lookbackMonths === 12) return;
  await assertPlanFeature(
    shopId,
    "backfillBeyond12Months",
    "Historical backfill beyond 12 months",
  );
}
