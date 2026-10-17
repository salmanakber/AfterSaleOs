"use client";

const LOGO = "/images/logo.png";

export function PoweredByAfterSale({ className = "" }: { className?: string }) {
  return (
    <a
      className={`as-powered ${className}`.trim()}
      href="https://aftersale.tidyflowapp.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by AfterSale"
    >
      <span className="as-powered__label">Powered by</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO} alt="AfterSale" className="as-powered__logo" />
      <span className="as-powered__name">AfterSale</span>
    </a>
  );
}
