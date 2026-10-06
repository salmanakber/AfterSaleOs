/** Merchant plan feature keys mirrored from Prisma `Plan` flags. */
export type PlanFeatureKey =
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
  | "erpConnectors"
  | "publicApiEnabled";

export type PlanEntitlements = {
  id: string;
  name: string;
  slug: string;
  priceMonthlyCents: number;
  warrantiesPerMonth: number;
  claimsPerMonth: number;
  aiCreditsPerMonth: number;
  staffSeats: number;
  warrantyRulesLimit: number;
  features: Record<PlanFeatureKey, boolean>;
};

export const PLAN_FEATURE_META: Record<
  PlanFeatureKey,
  { label: string; blurb: string; navHint?: string }
> = {
  customBranding: {
    label: "Custom branding",
    blurb: "Logo, colors, fonts, and hero style on customer pages.",
    navHint: "Customer pages",
  },
  pdfCertificate: {
    label: "PDF certificates",
    blurb: "Downloadable warranty PDFs for customers.",
  },
  qrCodes: {
    label: "QR codes",
    blurb: "Printable QR links that open registration and claim flows.",
    navHint: "QR codes",
  },
  csvExport: {
    label: "CSV export",
    blurb: "Export warranties and claims for finance and ops.",
  },
  backfillBeyond12Months: {
    label: "Deep history backfill",
    blurb: "Import warranties older than 12 months.",
  },
  repairsEnabled: {
    label: "Repairs desk",
    blurb: "Track repair jobs, technicians, and shipping.",
    navHint: "Repairs",
  },
  customWorkflows: {
    label: "Custom workflows",
    blurb: "Rename statuses and tailor claim pipelines.",
  },
  advancedAnalytics: {
    label: "Advanced analytics",
    blurb: "Deeper claim rate and coverage insights.",
  },
  flowEnabled: {
    label: "Shopify Flow",
    blurb: "Trigger Flow automations from AfterSale events.",
  },
  expiryCampaigns: {
    label: "Expiry campaigns",
    blurb: "Remind customers before coverage ends.",
  },
  bulkOperations: {
    label: "Bulk operations",
    blurb: "Act on many warranties or claims at once.",
  },
  supplierPortal: {
    label: "Supplier portal",
    blurb: "Route claims and parts to suppliers.",
    navHint: "Suppliers",
  },
  technicianPortal: {
    label: "Technician portal",
    blurb: "Give technicians a focused repair queue.",
  },
  partsInventory: {
    label: "Parts inventory",
    blurb: "Track spare parts against repairs.",
  },
  multiLocation: {
    label: "Multi-location",
    blurb: "Run coverage across multiple store locations.",
  },
  erpConnectors: {
    label: "ERP connectors",
    blurb: "Sync resolutions with external ERP systems.",
  },
  publicApiEnabled: {
    label: "Public API",
    blurb: "Programmatic access for custom integrations.",
  },
};

export function emptyFeatures(enabled = false): Record<PlanFeatureKey, boolean> {
  return {
    customBranding: enabled,
    pdfCertificate: enabled,
    qrCodes: enabled,
    csvExport: enabled,
    backfillBeyond12Months: enabled,
    repairsEnabled: enabled,
    customWorkflows: enabled,
    advancedAnalytics: enabled,
    flowEnabled: enabled,
    expiryCampaigns: enabled,
    bulkOperations: enabled,
    supplierPortal: enabled,
    technicianPortal: enabled,
    partsInventory: enabled,
    multiLocation: enabled,
    erpConnectors: enabled,
    publicApiEnabled: enabled,
  };
}

export function featuresFromPlan(plan: Partial<Record<PlanFeatureKey, boolean | null>> | null | undefined) {
  const base = emptyFeatures(false);
  if (!plan) return base;
  for (const key of Object.keys(base) as PlanFeatureKey[]) {
    if (typeof plan[key] === "boolean") base[key] = Boolean(plan[key]);
  }
  return base;
}

export function hasFeature(plan: PlanEntitlements | null | undefined, feature: PlanFeatureKey) {
  if (!plan) return false;
  return Boolean(plan.features[feature]);
}
