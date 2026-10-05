"use client";

/** Customer-facing branded loader. */
export function BrandLoader({
  label = "Opening AfterSale…",
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
        <span className="as-loader-core">A</span>
      </div>
      <p className="as-loader-label">{label}</p>
      <div className="as-loader-bar" aria-hidden>
        <span />
      </div>
    </div>
  );
}
