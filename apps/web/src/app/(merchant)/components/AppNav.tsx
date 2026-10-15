"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NavMenu } from "@shopify/app-bridge-react";
import { gqlRequest } from "@/lib/graphql";
import { appHref } from "@/lib/shop-context";
import type { PlanFeatureKey } from "@/lib/plan-features";
import { useMerchantAuth } from "../providers";

type NavItem = {
  href: string;
  label: string;
  group?: string;
  feature?: PlanFeatureKey;
  badgeKey?: keyof NavCounts;
};

type NavCounts = {
  claims: number;
  warranties: number;
  registrations: number;
  repairs: number;
  resolutions: number;
};

const NAV: NavItem[] = [
  { href: "/", label: "Home", group: "Overview" },
  { href: "/setup", label: "Setup wizard", group: "Overview" },
  { href: "/claims", label: "Claims", group: "Operations", badgeKey: "claims" },
  { href: "/repairs", label: "Repairs", group: "Operations", feature: "repairsEnabled", badgeKey: "repairs" },
  { href: "/resolutions", label: "Resolutions", group: "Operations", badgeKey: "resolutions" },
  { href: "/suppliers", label: "Suppliers", group: "Operations", feature: "supplierPortal" },
  { href: "/warranties", label: "Warranties", group: "Coverage", badgeKey: "warranties" },
  { href: "/registrations", label: "Registrations", group: "Coverage", badgeKey: "registrations" },
  { href: "/products-rules", label: "Products & Rules", group: "Coverage" },
  { href: "/automations", label: "Automations", group: "Setup" },
  { href: "/qr-codes", label: "QR codes", group: "Setup", feature: "qrCodes" },
  { href: "/team", label: "Team", group: "Setup" },
  { href: "/settings", label: "Customer pages", group: "Setup" },
  { href: "/plans", label: "Plans & Usage", group: "Setup" },
];

const NAV_COUNTS_QUERY = `#graphql
  query NavCounts {
    navCounts {
      claims
      warranties
      registrations
      repairs
      resolutions
    }
  }
`;

function pathActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatBadge(n: number) {
  if (n <= 0) return null;
  if (n > 99) return "99+";
  return String(n);
}

/** Shopify admin NavMenu + in-app sidebar (client navigation keeps shell mounted). */
export function AppNav() {
  const pathname = usePathname();
  const { plan } = useMerchantAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState<NavCounts | null>(null);
  const groups = ["Overview", "Operations", "Coverage", "Setup"] as const;

  const refreshCounts = useCallback(() => {
    gqlRequest<{ navCounts: NavCounts }>(NAV_COUNTS_QUERY)
      .then((d) => setCounts(d.navCounts))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshCounts();
    const t = window.setInterval(refreshCounts, 45_000);
    const onFocus = () => refreshCounts();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshCounts, pathname]);

  function isLocked(item: NavItem) {
    if (!item.feature || !plan) return false;
    return !plan.features[item.feature];
  }

  return (
    <div className="as-m-nav-column">
      <div className="as-m-navmenu-host" aria-hidden="true">
        <NavMenu>
          <a href={appHref("/")} rel="home">
            Home
          </a>
          {NAV.filter((i) => i.href !== "/").map((item) => (
            <a key={item.href} href={appHref(item.href)}>
              {item.label}
            </a>
          ))}
        </NavMenu>
      </div>

      <button
        type="button"
        className="as-m-sidebar-mobile-toggle"
        aria-label="Toggle navigation"
        onClick={() => setMobileOpen((v) => !v)}
      >
        Menu
      </button>

      <aside
        className={`as-m-sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
        aria-label="App navigation"
        data-tour="sidebar"
      >
        <div className="as-m-sidebar-head">
          <Link
            className="as-m-sidebar-brand"
            href={appHref("/")}
            onClick={() => setMobileOpen(false)}
            prefetch
            aria-label="AfterSale home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.png"
              alt="AfterSale"
              className={`as-m-sidebar-logo${collapsed ? " is-collapsed" : ""}`}
            />
          </Link>
          <button
            type="button"
            className="as-m-sidebar-collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="as-m-sidebar-nav">
          {groups.map((group) => {
            const items = NAV.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="as-m-sidebar-group">
                {!collapsed ? <div className="as-m-sidebar-label">{group}</div> : null}
                {items.map((item) => {
                  const locked = isLocked(item);
                  const badge =
                    item.badgeKey && counts ? formatBadge(counts[item.badgeKey]) : null;
                  return (
                    <Link
                      key={item.href}
                      href={appHref(item.href)}
                      className="as-m-sidebar-link"
                      data-active={pathActive(pathname, item.href)}
                      data-locked={locked || undefined}
                      title={
                        locked
                          ? `${item.label} · upgrade to unlock`
                          : badge
                            ? `${item.label} · ${badge} need attention`
                            : item.label
                      }
                      prefetch
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="as-m-sidebar-dot" aria-hidden />
                      {!collapsed ? (
                        <span className="as-m-sidebar-link-label">
                          <span className="as-m-sidebar-link-text">{item.label}</span>
                          {locked ? <em className="as-m-sidebar-lock">Pro</em> : null}
                          {badge && !locked ? (
                            <span className="as-m-sidebar-badge" aria-label={`${badge} new`}>
                              {badge}
                            </span>
                          ) : null}
                        </span>
                      ) : badge && !locked ? (
                        <span className="as-m-sidebar-badge as-m-sidebar-badge--dot" aria-hidden />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="as-m-sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
    </div>
  );
}
