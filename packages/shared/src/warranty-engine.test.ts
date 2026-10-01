import { describe, expect, it } from "vitest";
import {
  buildWarrantyDates,
  matchingRulesForProduct,
  selectRulesByType,
  unitsToVoidOnRefund,
  computeWarrantyStatus,
  type MatchableRule,
} from "./warranty-engine";

const base = (over: Partial<MatchableRule> & Pick<MatchableRule, "ruleId" | "targetType">): MatchableRule => ({
  ruleVersionId: `${over.ruleId}-v1`,
  warrantyType: "store",
  priority: 100,
  targetId: null,
  durationMonths: 12,
  startDateRule: "FULFILLMENT_DATE",
  gracePeriodDays: 0,
  ...over,
});

describe("rule matching + precedence", () => {
  it("matches default, product, variant, collection", () => {
    const rules = [
      base({ ruleId: "d", targetType: "default" }),
      base({ ruleId: "p", targetType: "product", targetId: "prod_1" }),
      base({ ruleId: "v", targetType: "variant", targetId: "var_1" }),
      base({ ruleId: "c", targetType: "collection", targetId: "col_1" }),
    ];
    const matched = matchingRulesForProduct(rules, {
      shopifyProductId: "prod_1",
      shopifyVariantId: "var_1",
      collectionIds: ["col_1"],
    });
    expect(matched.map((r) => r.ruleId).sort()).toEqual(["c", "d", "p", "v"]);
  });

  it("picks variant over product for same warranty type", () => {
    const winners = selectRulesByType(
      [
        base({ ruleId: "p", targetType: "product", targetId: "prod_1", priority: 1 }),
        base({ ruleId: "v", targetType: "variant", targetId: "var_1", priority: 50 }),
      ],
      { shopifyProductId: "prod_1", shopifyVariantId: "var_1" },
    );
    expect(winners).toHaveLength(1);
    expect(winners[0]!.ruleId).toBe("v");
  });

  it("allows stacking different warranty types", () => {
    const winners = selectRulesByType(
      [
        base({ ruleId: "store", targetType: "default", warrantyType: "store" }),
        base({
          ruleId: "mfr",
          targetType: "product",
          targetId: "prod_1",
          warrantyType: "manufacturer",
          durationMonths: 24,
        }),
      ],
      { shopifyProductId: "prod_1" },
    );
    expect(winners.map((w) => w.warrantyType).sort()).toEqual(["manufacturer", "store"]);
  });
});

describe("start dates and status", () => {
  it("stays pending_start until fulfillment when rule is FULFILLMENT_DATE", () => {
    const result = buildWarrantyDates({
      startDateRule: "FULFILLMENT_DATE",
      durationMonths: 12,
      timeZone: "UTC",
      purchaseAt: new Date("2025-01-01T12:00:00Z"),
      fulfilledAt: null,
    });
    expect(result.startAt).toBeNull();
    expect(result.status).toBe("PENDING_START");
  });

  it("activates on fulfillment and sets calendar end", () => {
    const result = buildWarrantyDates({
      startDateRule: "FULFILLMENT_DATE",
      durationMonths: 12,
      timeZone: "UTC",
      purchaseAt: new Date("2025-01-15T12:00:00Z"),
      fulfilledAt: new Date("2025-01-20T12:00:00Z"),
      now: new Date("2025-02-01T12:00:00Z"),
    });
    expect(result.startAt?.toISOString()).toBe("2025-01-20T12:00:00.000Z");
    expect(result.endAt).not.toBeNull();
    expect(result.status).toBe("ACTIVE");
  });

  it("marks expired after end", () => {
    expect(
      computeWarrantyStatus({
        startAt: new Date("2020-01-01T00:00:00Z"),
        endAt: new Date("2021-01-01T23:59:59.999Z"),
        now: new Date("2022-01-01T00:00:00Z"),
      }),
    ).toBe("EXPIRED");
  });
});

describe("partial refund void count", () => {
  it("voids min(remaining, refund qty)", () => {
    expect(
      unitsToVoidOnRefund({ lineQuantity: 3, alreadyVoidedUnits: 1, refundQuantity: 2 }),
    ).toBe(2);
    expect(
      unitsToVoidOnRefund({ lineQuantity: 3, alreadyVoidedUnits: 2, refundQuantity: 5 }),
    ).toBe(1);
  });
});
