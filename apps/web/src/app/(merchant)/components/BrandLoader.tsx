"use client";

const SYSTEM_LOGO = "/images/logo.png";

/** Premium AfterSale branded loader — merchant + customer surfaces. */
export function BrandLoader({
  label = "Loading…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={`as-loader${compact ? " as-loader--compact" : ""}`} role="status" aria-live="polite">
      <div className="as-loader-mark" aria-hidden>
        <span className="as-loader-ring" />
        <span className="as-loader-ring as-loader-ring-b" />
        <span className="as-loader-core as-loader-core--logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SYSTEM_LOGO} alt="" />
        </span>
      </div>
      <p className="as-loader-label">{label}</p>
      <div className="as-loader-bar" aria-hidden>
        <span />
      </div>
    </div>
  );
}
