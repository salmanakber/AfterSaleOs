"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NavMenu } from "@shopify/app-bridge-react";

type NavItem = { href: string; label: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "ops",
    label: "Operations",
    items: [
      { href: "/claims", label: "Claims" },
      { href: "/repairs", label: "Repairs" },
      { href: "/resolutions", label: "Resolutions" },
      { href: "/suppliers", label: "Suppliers" },
    ],
  },
  {
    id: "coverage",
    label: "Coverage",
    items: [
      { href: "/warranties", label: "Warranties" },
      { href: "/registrations", label: "Registrations" },
      { href: "/products-rules", label: "Products & Rules" },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    items: [
      { href: "/automations", label: "Automations" },
      { href: "/settings", label: "Customer pages" },
      { href: "/plans", label: "Plans & Usage" },
    ],
  },
];

const FLAT_LINKS: NavItem[] = [
  { href: "/", label: "Home" },
  ...NAV_GROUPS.flatMap((g) => g.items),
];

function pathActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Shopify admin nav (App Bridge) + in-app menu bar with dropdowns. */
export function AppNav() {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpenId(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!barRef.current?.contains(e.target as Node)) {
        setOpenId(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <>
      {/* Portaled into Shopify admin chrome — never show these anchors in-app. */}
      <div className="as-m-navmenu-host" aria-hidden="true">
        <NavMenu>
          <a href="/" rel="home">
            Home
          </a>
          {FLAT_LINKS.filter((l) => l.href !== "/").map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </NavMenu>
      </div>

      <nav className="as-m-menubar" ref={barRef} aria-label="AfterSale navigation">
        <a className="as-m-menubar-brand" href="/" data-active={pathActive(pathname, "/")}>
          <span className="as-m-menubar-mark">A</span>
          <span className="as-m-menubar-title">AfterSale OS</span>
        </a>

        <div className={`as-m-menubar-links${mobileOpen ? " is-open" : ""}`}>
          <a className="as-m-menubar-link" href="/" data-active={pathActive(pathname, "/")}>
            Home
          </a>

          {NAV_GROUPS.map((group) => {
            const groupActive = group.items.some((i) => pathActive(pathname, i.href));
            const open = openId === group.id;
            return (
              <div key={group.id} className="as-m-menubar-dropdown">
                <button
                  type="button"
                  className="as-m-menubar-trigger"
                  data-active={groupActive}
                  data-open={open}
                  aria-expanded={open}
                  aria-haspopup="menu"
                  onClick={() => setOpenId(open ? null : group.id)}
                >
                  {group.label}
                  <span className="as-m-menubar-caret" aria-hidden>
                    ▾
                  </span>
                </button>
                {open ? (
                  <div className="as-m-menubar-panel" role="menu">
                    {group.items.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        data-active={pathActive(pathname, item.href)}
                        onClick={() => setOpenId(null)}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="as-m-menubar-burger"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>
    </>
  );
}
