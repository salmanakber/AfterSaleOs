import type { PlanFeatureKey } from "@/lib/plan-features";
import { PLAN_FEATURE_META } from "@/lib/plan-features";

export type PublicPlan = {
  id: string;
  name: string;
  slug: string;
  priceMonthlyCents: number;
  isFree: boolean;
  warrantiesPerMonth: number;
  claimsPerMonth: number;
  aiCreditsPerMonth: number;
  staffSeats: number;
  warrantyRulesLimit: number;
  attachmentStorageMb: number;
  locationsLimit: number;
  technicianAccounts: number;
  sortOrder: number;
  features: Record<PlanFeatureKey, boolean>;
};

const BLURBS: Record<string, string> = {
  free: "Start registering products and learning the workflow.",
  starter: "For growing catalogs that need branding, QR, and certificates.",
  growth: "Ops teams running repairs, automations, and higher volume.",
  pro: "High-volume brands that need scale, API, and multi-location.",
};

/** Highlight Growth when present; else first paid plan. */
export function isFeaturedPlan(plan: PublicPlan, all: PublicPlan[]) {
  if (plan.slug === "growth") return true;
  const growth = all.some((p) => p.slug === "growth");
  if (growth) return false;
  const firstPaid = all.find((p) => !p.isFree);
  return Boolean(firstPaid && firstPaid.id === plan.id);
}

export function formatMoney(cents: number) {
  if (cents <= 0) return "$0";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function formatQuota(n: number, unlimitedAt = 9999) {
  if (n >= unlimitedAt) return "Unlimited";
  return n.toLocaleString();
}

export function formatRules(n: number) {
  if (n >= 9999) return "Unlimited";
  return `${n.toLocaleString()} rule${n === 1 ? "" : "s"}`;
}

export function formatSeats(n: number) {
  return `${n.toLocaleString()} seat${n === 1 ? "" : "s"}`;
}

/** Build bullet list from DB flags (included features only, capped). */
export function planFeatureBullets(plan: PublicPlan, previous?: PublicPlan | null) {
  const bullets: string[] = [];
  if (previous) {
    bullets.push(`Everything in ${previous.name}`);
  } else {
    bullets.push("Product registration & claims");
    bullets.push("Customer portal");
    bullets.push("Shopify Admin workspace");
  }

  const keys = Object.keys(PLAN_FEATURE_META) as PlanFeatureKey[];
  for (const key of keys) {
    const on = plan.features[key];
    const wasOn = previous ? previous.features[key] : false;
    if (on && !wasOn) {
      bullets.push(PLAN_FEATURE_META[key].label);
    }
  }

  return bullets.slice(0, previous ? 6 : 5);
}

export function planBlurb(plan: PublicPlan) {
  return BLURBS[plan.slug] ?? `${plan.name} plan for AfterSale OS on Shopify.`;
}

export function planCta(plan: PublicPlan) {
  if (plan.isFree) return "Start on Free";
  return `Choose ${plan.name}`;
}

/** The 8 marketplace comparison rows, values derived from live plan rows. */
export function buildCompareRows(plans: PublicPlan[]) {
  return [
    {
      label: "Monthly warranty registrations",
      cell: (p: PublicPlan) => formatQuota(p.warrantiesPerMonth),
    },
    {
      label: "Monthly claims",
      cell: (p: PublicPlan) => formatQuota(p.claimsPerMonth, 99999),
    },
    {
      label: "Warranty rules",
      cell: (p: PublicPlan) => formatQuota(p.warrantyRulesLimit),
    },
    {
      label: "Staff seats",
      cell: (p: PublicPlan) => String(p.staffSeats),
    },
    {
      label: "Custom branding & customer portal",
      cell: (p: PublicPlan) => p.features.customBranding,
    },
    {
      label: "QR codes & PDF certificates",
      cell: (p: PublicPlan) => p.features.qrCodes && p.features.pdfCertificate,
    },
    {
      label: "Repairs & claim automations",
      cell: (p: PublicPlan) =>
        p.features.repairsEnabled && (p.features.customWorkflows || p.features.expiryCampaigns),
    },
    {
      label: "Team invites, exports & advanced tools",
      cell: (p: PublicPlan): string | boolean => {
        if (p.features.publicApiEnabled) return "API +";
        if (p.features.csvExport && (p.features.bulkOperations || p.features.advancedAnalytics)) {
          return true;
        }
        if (p.features.csvExport || p.features.backfillBeyond12Months) return "Basic";
        return false;
      },
    },
  ] as const;
}
