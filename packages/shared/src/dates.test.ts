import { describe, expect, it } from "vitest";
import { addCalendarMonths, computeWarrantyEnd, pickWinningRule } from "./dates";
import { evaluateEligibility } from "./eligibility";

describe("addCalendarMonths", () => {
  it("clamps Jan 31 + 1 month to Feb 28 (non-leap)", () => {
    const start = new Date(Date.UTC(2025, 0, 31));
    const end = addCalendarMonths(start, 1);
    expect(end.getUTCFullYear()).toBe(2025);
    expect(end.getUTCMonth()).toBe(1);
    expect(end.getUTCDate()).toBe(28);
  });

  it("clamps Jan 31 + 1 month to Feb 29 (leap)", () => {
    const start = new Date(Date.UTC(2024, 0, 31));
    const end = addCalendarMonths(start, 1);
    expect(end.getUTCDate()).toBe(29);
  });
});

describe("computeWarrantyEnd", () => {
  it("returns null for lifetime", () => {
    expect(
      computeWarrantyEnd({
        startAt: new Date(),
        durationMonths: null,
        timeZone: "UTC",
      }),
    ).toBeNull();
  });

  it("includes end-of-day UTC", () => {
    const start = new Date(Date.UTC(2025, 0, 15, 12, 0, 0));
    const end = computeWarrantyEnd({
      startAt: start,
      durationMonths: 12,
      timeZone: "UTC",
    });
    expect(end).not.toBeNull();
    expect(end!.getUTCHours()).toBe(23);
    expect(end!.getUTCMinutes()).toBe(59);
  });
});

describe("rule precedence", () => {
  it("prefers variant over product over collection over default", () => {
    const winner = pickWinningRule([
      { targetType: "default" as const, priority: 1, id: "d" },
      { targetType: "collection" as const, priority: 1, id: "c" },
      { targetType: "product" as const, priority: 50, id: "p" },
      { targetType: "variant" as const, priority: 100, id: "v" },
    ]);
    expect(winner?.id).toBe("v");
  });

  it("breaks ties with lower priority number winning via score", () => {
    const winner = pickWinningRule([
      { targetType: "product" as const, priority: 10, id: "a" },
      { targetType: "product" as const, priority: 5, id: "b" },
    ]);
    expect(winner?.id).toBe("b");
  });
});

describe("eligibility", () => {
  it("never auto-rejects expired warranties", () => {
    const result = evaluateEligibility({
      hasMatchingRule: true,
      warrantyStatus: "expired",
      withinGracePeriod: false,
      serialMismatch: false,
      requiresManualReview: false,
    });
    expect(result.outcome).toBe("outside_warranty_needs_review");
  });

  it("marks active coverage as eligible", () => {
    const result = evaluateEligibility({
      hasMatchingRule: true,
      warrantyStatus: "active",
      withinGracePeriod: false,
      serialMismatch: false,
      requiresManualReview: false,
    });
    expect(result.outcome).toBe("eligible");
  });
});
