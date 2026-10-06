"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { appHref } from "@/lib/shop-context";
import { PLAN_FEATURE_META, type PlanFeatureKey } from "@/lib/plan-features";
import { useMerchantAuth } from "../providers";

export function FeatureLock({
  feature,
  children,
  mode = "overlay",
  className,
}: {
  feature: PlanFeatureKey;
  children: ReactNode;
  /** overlay = dim content + lock card; replace = only lock card */
  mode?: "overlay" | "replace";
  className?: string;
}) {
  const { plan, needsPlanSelection } = useMerchantAuth();
  const allowed = !needsPlanSelection && Boolean(plan?.features[feature]);
  if (allowed) return <>{children}</>;

  const meta = PLAN_FEATURE_META[feature];
  const planName = plan?.name ?? "your current plan";

  const lock = (
    <div className="as-m-feature-lock">
      <div className="as-m-feature-lock-card">
        <span className="as-m-feature-lock-badge">Not on {planName}</span>
        <h3>{meta.label}</h3>
        <p>{meta.blurb}</p>
        <p className="as-m-feature-lock-hint">
          Upgrade to unlock this feature. Your current plan stays active until you choose a new one.
        </p>
        <div className="as-m-feature-lock-actions">
          <Link className="as-m-feature-lock-cta" href={appHref("/plans")}>
            View plans
          </Link>
        </div>
      </div>
    </div>
  );

  if (mode === "replace") {
    return <div className={className}>{lock}</div>;
  }

  return (
    <div className={`as-m-feature-lock-wrap${className ? ` ${className}` : ""}`}>
      <div className="as-m-feature-lock-dim" aria-hidden>
        {children}
      </div>
      {lock}
    </div>
  );
}

export function useFeatureAccess(feature: PlanFeatureKey) {
  const { plan, needsPlanSelection } = useMerchantAuth();
  return {
    allowed: !needsPlanSelection && Boolean(plan?.features[feature]),
    plan,
    meta: PLAN_FEATURE_META[feature],
  };
}
