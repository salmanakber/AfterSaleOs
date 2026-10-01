export type EligibilityOutcome =
  | "eligible"
  | "eligible_needs_review"
  | "outside_warranty_needs_review"
  | "not_covered_by_rule";

export type EligibilityInput = {
  hasMatchingRule: boolean;
  warrantyStatus: "pending_start" | "active" | "expiring_soon" | "expired" | "void" | "pending_verification";
  withinGracePeriod: boolean;
  serialMismatch: boolean;
  requiresManualReview: boolean;
};

/**
 * Eligibility never hard-blocks (§4.10). Expired is a soft flag for merchant decision.
 */
export function evaluateEligibility(input: EligibilityInput): {
  outcome: EligibilityOutcome;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (!input.hasMatchingRule) {
    reasons.push("No warranty rule covers this product.");
    return { outcome: "not_covered_by_rule", reasons };
  }

  if (input.warrantyStatus === "void") {
    reasons.push("Warranty was voided.");
    return { outcome: "outside_warranty_needs_review", reasons };
  }

  if (input.serialMismatch) {
    reasons.push("Serial number needs review.");
    return { outcome: "eligible_needs_review", reasons };
  }

  if (input.warrantyStatus === "pending_verification" || input.requiresManualReview) {
    reasons.push("Registration or claim requires merchant verification.");
    return { outcome: "eligible_needs_review", reasons };
  }

  if (input.warrantyStatus === "expired") {
    if (input.withinGracePeriod) {
      reasons.push("Warranty expired but within configured grace period.");
      return { outcome: "eligible_needs_review", reasons };
    }
    reasons.push("Warranty is past end date (soft flag — merchant decides).");
    return { outcome: "outside_warranty_needs_review", reasons };
  }

  if (input.warrantyStatus === "pending_start") {
    reasons.push("Warranty has not started yet.");
    return { outcome: "eligible_needs_review", reasons };
  }

  reasons.push("Within active warranty coverage.");
  return { outcome: "eligible", reasons };
}
