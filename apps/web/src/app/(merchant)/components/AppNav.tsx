"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavMenu } from "@shopify/app-bridge-react";
import { appHref } from "@/lib/shop-context";

type NavItem = { href: string; label: string; group?: string };

const NAV: NavItem[] = [
  { href: "/", label: "Home", group: "Overview" },
  { href: "/setup", label: "Setup wizard", group: "Overview" },
  { href: "/claims", label: "Claims", group: "Operations" },
  { href: "/repairs", label: "Repairs", group: "Operations" },
  { href: "/resolutions", label: "Resolutions", group: "Operations" },
  { href: "/suppliers", label: "Suppliers", group: "Operations" },
  { href: "/warranties", label: "Warranties", group: "Coverage" },
  { href: "/registrations", label: "Registrations", group: "Coverage" },
  { href: "/products-rules", label: "Products & Rules", group: "Coverage" },
  { href: "/automations", label: "Automations", group: "Setup" },
  { href: "/qr-codes", label: "QR codes", group: "Setup" },
  { href: "/team", label: "Team", group: "Setup" },
  { href: "/settings", label: "Customer pages", group: "Setup" },
  { href: "/plans", label: "Plans & Usage", group: "Setup" },
];

function pathActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Shopify admin NavMenu + minimal in-app sidebar. */
export function AppNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = ["Overview", "Operations", "Coverage", "Setup"] as const;

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
          <a className="as-m-sidebar-brand" href={appHref("/")} onClick={() => setMobileOpen(false)}>
            <span className="as-m-sidebar-mark">AS</span>
            {!collapsed ? <span className="as-m-sidebar-name">AfterSale</span> : null}
          </a>
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
                {items.map((item) => (
                  <a
                    key={item.href}
                    href={appHref(item.href)}
                    className="as-m-sidebar-link"
                    data-active={pathActive(pathname, item.href)}
                    title={item.label}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="as-m-sidebar-dot" aria-hidden />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </a>
                ))}
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
