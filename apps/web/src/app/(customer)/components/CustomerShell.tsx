"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { publicApiUrl } from "@/lib/public-api";
import { ThemeToggle } from "./ThemeToggle";

export function CustomerShell({
  brand = "AfterSale",
  title,
  lede,
  children,
  footer,
  steps,
  activeStep,
  shopDomain = "",
  embed = false,
}: {
  brand?: string;
  title: string;
  lede?: string;
  children: ReactNode;
  footer?: ReactNode;
  steps?: string[];
  activeStep?: number;
  shopDomain?: string;
  embed?: boolean;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [accent, setAccent] = useState("#F59E0B");
  const [shopName, setShopName] = useState(brand);

  useEffect(() => {
    if (!shopDomain) return;
    let cancelled = false;
    fetch(publicApiUrl(`/api/public/branding?shop=${encodeURIComponent(shopDomain)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setLogoUrl(json.logoUrl ?? null);
        const nextAccent = json.accentColor ?? "#F59E0B";
        setAccent(nextAccent);
        setShopName(json.shopName || brand);
        const root = document.documentElement;
        root.style.setProperty("--as-accent", nextAccent);
        root.style.setProperty("--as-primary", nextAccent);
        root.style.setProperty("--as-primary-hover", nextAccent);
        root.style.setProperty("--as-primary-tint", `color-mix(in srgb, ${nextAccent} 14%, white)`);
        root.style.setProperty("--as-primary-soft", `color-mix(in srgb, ${nextAccent} 18%, transparent)`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shopDomain, brand]);

  const displayBrand = shopName && shopName !== "AfterSale" ? shopName : brand;
  const showDefaultMark = !logoUrl && (!displayBrand || displayBrand === "AfterSale");
  const brandStyle = {
    ["--as-accent"]: accent,
    ["--as-primary"]: accent,
    ["--as-primary-hover"]: accent,
    ["--as-primary-tint"]: `color-mix(in srgb, ${accent} 14%, white)`,
    ["--as-primary-soft"]: `color-mix(in srgb, ${accent} 18%, transparent)`,
  } as CSSProperties;

  return (
    <div className={`as-shell${embed ? " as-shell-embed" : ""}`} style={brandStyle}>
      {!embed ? (
        <div className="as-topbar as-no-print">
          <div className="as-mark-lockup">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="as-brand-logo" />
            ) : (
              <span className="as-mark">A</span>
            )}
            <span className="as-mark-text">{displayBrand === "AfterSale" ? "AfterSale" : displayBrand}</span>
          </div>
          <ThemeToggle />
        </div>
      ) : null}

      <header className="as-hero">
        <div className="as-kicker">
          <span className="as-kicker-dot" />
          {displayBrand === "AfterSale" ? "Warranty & care" : `${displayBrand} · Warranty & care`}
        </div>
        <h1 className="as-brand">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={displayBrand} className="as-brand-logo-lg" />
          ) : showDefaultMark ? (
            <>
              After<span>Sale</span>
            </>
          ) : (
            displayBrand
          )}
        </h1>
        <h2 className="as-hero-title">{title}</h2>
        {lede ? <p className="as-hero-sub">{lede}</p> : null}
      </header>

      {steps && steps.length > 0 && !embed ? (
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
      {footer && !embed ? <div className="as-footer-note">{footer}</div> : null}
    </div>
  );
}
