"use client";

import type { ReactNode } from "react";
import { BrandLoader } from "./BrandLoader";

/** Full-page wait state while merchant list/detail data loads. */
export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="as-m-page-loading" role="status" aria-live="polite">
      <BrandLoader label={label} compact />
    </div>
  );
}

/** Compact empty state for ops/coverage lists. */
export function PageEmpty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="as-m-empty-panel">
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {action ? <div className="as-m-empty-actions">{action}</div> : null}
    </div>
  );
}
