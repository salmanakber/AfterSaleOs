"use client";

import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function CustomerShell({
  brand = "AfterSale",
  title,
  lede,
  children,
  footer,
  steps,
  activeStep,
}: {
  brand?: string;
  title: string;
  lede?: string;
  children: ReactNode;
  footer?: ReactNode;
  steps?: string[];
  activeStep?: number;
}) {
  const showMark = !brand || brand === "AfterSale";

  return (
    <div className="as-shell">
      <div className="as-topbar as-no-print">
        <div className="as-mark-lockup" aria-hidden={showMark ? undefined : true}>
          <span className="as-mark">A</span>
          <span className="as-mark-text">AfterSale OS</span>
        </div>
        <ThemeToggle />
      </div>

      <header className="as-hero">
        <div className="as-kicker">
          <span className="as-kicker-dot" />
          Warranty &amp; care
        </div>
        <h1 className="as-brand">
          {showMark ? (
            <>
              After<span>Sale</span>
            </>
          ) : (
            brand
          )}
        </h1>
        <p className="as-lede">
          <strong>{title}</strong>
          {lede ? <span> — {lede}</span> : null}
        </p>
      </header>

      {steps && steps.length > 0 ? (
        <ol className="as-steps as-no-print" aria-label="Progress">
          {steps.map((label, index) => {
            const state =
              activeStep === undefined
                ? "idle"
                : index < activeStep
                  ? "done"
                  : index === activeStep
                    ? "current"
                    : "upcoming";
            return (
              <li key={label} data-state={state}>
                <span className="as-step-index">{index + 1}</span>
                <span className="as-step-label">{label}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="as-panel">{children}</div>
      {footer ? <div className="as-footer-note">{footer}</div> : null}
    </div>
  );
}
