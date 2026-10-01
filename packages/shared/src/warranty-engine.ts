import { computeWarrantyEnd, pickWinningRule, type RuleTargetType } from "./dates";

export type StartDateRuleKind =
  | "PURCHASE_DATE"
  | "FULFILLMENT_DATE"
  | "DELIVERY_DATE"
  | "REGISTRATION_DATE"
  | "FIXED_DATE";

export type MatchableRule = {
  ruleId: string;
  ruleVersionId: string;
  warrantyType: string;
  priority: number;
  targetType: RuleTargetType;
  targetId: string | null;
  durationMonths: number | null;
  startDateRule: StartDateRuleKind;
  gracePeriodDays: number;
};

export type ProductMatchContext = {
  shopifyVariantId?: string | null;
  shopifyProductId?: string | null;
  collectionIds?: string[];
};

/** Rules that apply to this product context (before per-type winner). */
export function matchingRulesForProduct(
  rules: MatchableRule[],
  ctx: ProductMatchContext,
): MatchableRule[] {
  return rules.filter((r) => {
    if (r.targetType === "default") return true;
    if (r.targetType === "variant") {
      return Boolean(ctx.shopifyVariantId && r.targetId === ctx.shopifyVariantId);
    }
    if (r.targetType === "product") {
      return Boolean(ctx.shopifyProductId && r.targetId === ctx.shopifyProductId);
    }
    if (r.targetType === "collection") {
      return Boolean(r.targetId && (ctx.collectionIds ?? []).includes(r.targetId));
    }
    return false;
  });
}

/**
 * One winning rule per warrantyType (store / manufacturer / extended).
 * Within a type: variant > product > collection > default, then priority.
 */
export function selectRulesByType(rules: MatchableRule[], ctx: ProductMatchContext): MatchableRule[] {
  const matched = matchingRulesForProduct(rules, ctx);
  const byType = new Map<string, MatchableRule[]>();
  for (const r of matched) {
    const list = byType.get(r.warrantyType) ?? [];
    list.push(r);
    byType.set(r.warrantyType, list);
  }
  const winners: MatchableRule[] = [];
  for (const group of byType.values()) {
    const winner = pickWinningRule(group);
    if (winner) winners.push(winner);
  }
  return winners;
}

export function resolveStartDate(params: {
  startDateRule: StartDateRuleKind;
  purchaseAt?: Date | null;
  fulfilledAt?: Date | null;
  deliveredAt?: Date | null;
  registrationAt?: Date | null;
  fixedAt?: Date | null;
}): Date | null {
  switch (params.startDateRule) {
    case "PURCHASE_DATE":
      return params.purchaseAt ?? null;
    case "FULFILLMENT_DATE":
      return params.fulfilledAt ?? null;
    case "DELIVERY_DATE":
      return params.deliveredAt ?? null;
    case "REGISTRATION_DATE":
      return params.registrationAt ?? null;
    case "FIXED_DATE":
      return params.fixedAt ?? null;
    default:
      return null;
  }
}

export type ComputedWarrantyStatus =
  | "PENDING_START"
  | "ACTIVE"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "VOID"
  | "PENDING_VERIFICATION";

export function computeWarrantyStatus(params: {
  voided?: boolean;
  pendingVerification?: boolean;
  startAt: Date | null;
  endAt: Date | null;
  now?: Date;
  expiringSoonDays?: number;
}): ComputedWarrantyStatus {
  if (params.voided) return "VOID";
  if (params.pendingVerification) return "PENDING_VERIFICATION";
  if (!params.startAt) return "PENDING_START";

  const now = params.now ?? new Date();
  if (params.startAt.getTime() > now.getTime()) return "PENDING_START";

  if (params.endAt) {
    if (params.endAt.getTime() < now.getTime()) return "EXPIRED";
    const days = params.expiringSoonDays ?? 30;
    const soon = params.endAt.getTime() - days * 24 * 3600_000;
    if (now.getTime() >= soon) return "EXPIRING_SOON";
  }
  return "ACTIVE";
}

export function buildWarrantyDates(params: {
  startDateRule: StartDateRuleKind;
  durationMonths: number | null;
  timeZone: string;
  purchaseAt?: Date | null;
  fulfilledAt?: Date | null;
  deliveredAt?: Date | null;
  registrationAt?: Date | null;
  fixedAt?: Date | null;
  now?: Date;
}): { startAt: Date | null; endAt: Date | null; status: ComputedWarrantyStatus } {
  const startAt = resolveStartDate(params);
  const endAt = startAt
    ? computeWarrantyEnd({
        startAt,
        durationMonths: params.durationMonths,
        timeZone: params.timeZone,
      })
    : null;
  const status = computeWarrantyStatus({ startAt, endAt, now: params.now });
  return { startAt, endAt, status };
}

/** How many units to void on a partial refund (by quantity). */
export function unitsToVoidOnRefund(params: {
  lineQuantity: number;
  alreadyVoidedUnits: number;
  refundQuantity: number;
}): number {
  const remaining = Math.max(0, params.lineQuantity - params.alreadyVoidedUnits);
  return Math.min(remaining, Math.max(0, params.refundQuantity));
}

export function randomCertificateToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
