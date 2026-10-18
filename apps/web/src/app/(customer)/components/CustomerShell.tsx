"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { publicApiUrl } from "@/lib/public-api";
import type { EmbedCols, EmbedStyle, EmbedWidth } from "@/lib/embed-layout";
import { PoweredByAfterSale } from "./PoweredByAfterSale";
import { ThemeToggle } from "./ThemeToggle";

const SYSTEM_LOGO = "/images/logo.png";

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
  /** Theme Liquid embeds: use block colors only — never fetch hosted brand kit. */
  themeLocal = false,
  accentOverride,
  embedCols = "2",
  embedWidth = "wide",
  embedStyle = "cards",
  /** Compact chrome for the unified client portal dashboard */
  chrome = "default",
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
  themeLocal?: boolean;
  accentOverride?: string | null;
  embedCols?: EmbedCols;
  embedWidth?: EmbedWidth;
  embedStyle?: EmbedStyle;
  chrome?: "default" | "dashboard";
}) {
  const skipHostedBrand = embed || themeLocal;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [accent, setAccent] = useState(accentOverride || "#F59E0B");
  const [shopName, setShopName] = useState(brand);
  const [design, setDesign] = useState<{
    bg?: string | null;
    surface?: string | null;
    text?: string | null;
    font?: string | null;
    radius?: number | null;
    buttonStyle?: string | null;
    heroStyle?: string | null;
  }>({});

  useEffect(() => {
    if (accentOverride) setAccent(accentOverride);
  }, [accentOverride]);

  useEffect(() => {
    if (!shopDomain || skipHostedBrand) return;
    let cancelled = false;
    fetch(publicApiUrl(`/api/public/branding?shop=${encodeURIComponent(shopDomain)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setLogoUrl(json.logoUrl ?? null);
        const nextAccent = json.accentColor ?? "#F59E0B";
        setAccent(nextAccent);
        setShopName(json.shopName || brand);
        setDesign({
          bg: json.bgColor,
          surface: json.surfaceColor,
          text: json.textColor,
          font: json.font,
          radius: json.radius,
          buttonStyle: json.buttonStyle,
          heroStyle: json.heroStyle,
        });
        const root = document.documentElement;
        root.style.setProperty("--as-accent", nextAccent);
        root.style.setProperty("--as-primary", nextAccent);
        root.style.setProperty("--as-primary-hover", nextAccent);
        root.style.setProperty("--as-primary-tint", `color-mix(in srgb, ${nextAccent} 14%, white)`);
        root.style.setProperty("--as-primary-soft", `color-mix(in srgb, ${nextAccent} 18%, transparent)`);
        if (json.bgColor) root.style.setProperty("--as-bg", json.bgColor);
        if (json.surfaceColor) root.style.setProperty("--as-surface", json.surfaceColor);
        if (json.textColor) root.style.setProperty("--as-ink", json.textColor);
        if (json.radius != null) root.style.setProperty("--as-radius", `${json.radius}px`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shopDomain, brand, skipHostedBrand]);

  const displayBrand = shopName && shopName !== "AfterSale" ? shopName : brand;
  const isSystemBrand = !displayBrand || displayBrand === "AfterSale";
  const resolvedLogo = logoUrl || (isSystemBrand ? SYSTEM_LOGO : null);
  const brandStyle = {
    ["--as-accent"]: accent,
    ["--as-primary"]: accent,
    ["--as-primary-hover"]: accent,
    ["--as-primary-tint"]: `color-mix(in srgb, ${accent} 14%, white)`,
    ["--as-primary-soft"]: `color-mix(in srgb, ${accent} 18%, transparent)`,
    ...(design.bg ? { ["--as-bg"]: design.bg } : {}),
    ...(design.surface ? { ["--as-surface"]: design.surface } : {}),
    ...(design.text ? { ["--as-ink"]: design.text } : {}),
    ...(design.radius != null ? { ["--as-radius"]: `${design.radius}px` } : {}),
  } as CSSProperties;

  const fontClass =
    design.font === "serif"
      ? " as-font-serif"
      : design.font === "display"
        ? " as-font-display-mode"
        : "";
  const heroClass =
    design.heroStyle === "calm"
      ? " as-hero-calm"
      : design.heroStyle === "minimal"
        ? " as-hero-minimal"
        : "";
  const buttonClass =
    design.buttonStyle === "soft"
      ? " as-btn-style-soft"
      : design.buttonStyle === "outline"
        ? " as-btn-style-outline"
        : "";

  const isDashboard = chrome === "dashboard";

  // Theme-block portal: same dashboard UI as self-hosted — never the stripped form embed chrome.
  // Legacy form embeds (claim/register without dashboard) keep as-shell-embed.
  if (embed && !isDashboard) {
    return (
      <div
        className={`as-shell as-shell-embed as-shell-embed--${embedWidth} as-shell-embed--${embedStyle}${skipHostedBrand ? " as-shell-theme-local" : ""}${fontClass}${buttonClass}`}
        style={brandStyle}
        data-embed="1"
        data-cols={embedCols}
        data-width={embedWidth}
        data-style={embedStyle}
      >
        <div className="as-embed-main">{children}</div>
        <PoweredByAfterSale className="as-powered--embed" />
      </div>
    );
  }

  return (
    <div
      className={`as-shell${isDashboard ? " as-shell-dash" : ""}${embed ? " as-shell-in-theme" : ""}${skipHostedBrand ? " as-shell-theme-local" : ""}${fontClass}${buttonClass}`}
      style={brandStyle}
      data-hero={design.heroStyle || "bold"}
      data-embed={embed ? "1" : undefined}
      data-cols={embed ? embedCols : undefined}
      data-width={embed ? embedWidth : undefined}
    >
      <div className="as-topbar as-no-print">
        <div className="as-mark-lockup">
          {resolvedLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolvedLogo} alt={displayBrand} className="as-brand-logo" />
          ) : (
            <span className="as-mark-text">{displayBrand}</span>
          )}
          {!isSystemBrand && resolvedLogo ? (
            <span className="as-mark-text">{displayBrand}</span>
          ) : null}
        </div>
        {!embed ? <ThemeToggle /> : null}
      </div>

      {!isDashboard ? (
        <header className={`as-hero${heroClass}`}>
          <div className="as-kicker">
            <span className="as-kicker-dot" />
            {isSystemBrand ? "Warranty & care" : `${displayBrand} · Warranty & care`}
          </div>
          <h1 className="as-brand">
            {resolvedLogo && !skipHostedBrand ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolvedLogo} alt={displayBrand} className="as-brand-logo-lg" />
            ) : skipHostedBrand && isSystemBrand ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={SYSTEM_LOGO} alt="AfterSale" className="as-brand-logo-lg" />
            ) : (
              displayBrand
            )}
          </h1>
          <h2 className="as-hero-title">{title}</h2>
          {lede ? <p className="as-hero-sub">{lede}</p> : null}
        </header>
      ) : null}

      {!isDashboard && steps && steps.length > 0 ? (
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

      <div className={isDashboard ? "as-panel as-panel-dash" : "as-panel"}>{children}</div>
      {footer ? <div className="as-footer-note">{footer}</div> : null}
      <PoweredByAfterSale />
    </div>
  );
}
