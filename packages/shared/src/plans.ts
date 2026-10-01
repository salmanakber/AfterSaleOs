export type PlanSlug = "free" | "starter" | "growth" | "pro";

export const USAGE_METRICS = {
  WARRANTIES_CREATED: "warranties_created",
  CLAIMS_CREATED: "claims_created",
  AI_CREDITS: "ai_credits",
  STORAGE_BYTES: "storage_bytes",
  SMS_SENT: "sms_sent",
  WHATSAPP_SENT: "whatsapp_sent",
} as const;

export type UsageMetric = (typeof USAGE_METRICS)[keyof typeof USAGE_METRICS];

export const PLAN_LIMITS: Record<
  PlanSlug,
  {
    warrantiesPerMonth: number;
    claimsPerMonth: number;
    attachmentStorageMb: number;
    staffSeats: number;
    aiCreditsPerMonth: number;
    warrantyRulesLimit: number;
    locationsLimit: number;
    technicianAccounts: number;
    publicApi: boolean;
  }
> = {
  free: {
    warrantiesPerMonth: 50,
    claimsPerMonth: 10,
    attachmentStorageMb: 1024,
    staffSeats: 1,
    aiCreditsPerMonth: 10,
    warrantyRulesLimit: 3,
    locationsLimit: 1,
    technicianAccounts: 0,
    publicApi: false,
  },
  starter: {
    warrantiesPerMonth: 500,
    claimsPerMonth: 100,
    attachmentStorageMb: 10240,
    staffSeats: 2,
    aiCreditsPerMonth: 50,
    warrantyRulesLimit: 10,
    locationsLimit: 1,
    technicianAccounts: 0,
    publicApi: false,
  },
  growth: {
    warrantiesPerMonth: 2500,
    claimsPerMonth: 500,
    attachmentStorageMb: 51200,
    staffSeats: 5,
    aiCreditsPerMonth: 300,
    warrantyRulesLimit: 9999,
    locationsLimit: 3,
    technicianAccounts: 5,
    publicApi: false,
  },
  pro: {
    warrantiesPerMonth: 10000,
    claimsPerMonth: 99999,
    attachmentStorageMb: 256000,
    staffSeats: 15,
    aiCreditsPerMonth: 1500,
    warrantyRulesLimit: 9999,
    locationsLimit: 10,
    technicianAccounts: 25,
    publicApi: true,
  },
};

/** Merchant-side features may be restricted; customer claim/registration is never blocked. */
export function isOverLimit(used: number, limit: number): boolean {
  return used >= limit;
}
