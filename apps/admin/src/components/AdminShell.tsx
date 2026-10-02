"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/shops", label: "Shops" },
  { href: "/ops", label: "Ops" },
  { href: "/compliance", label: "Compliance" },
  { href: "/settings", label: "Settings" },
];

export function AdminShell({
  title,
  lede,
  children,
  actions,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="sa-app">
      <div className="sa-atmosphere" aria-hidden="true">
        <span className="sa-orb sa-orb-a" />
        <span className="sa-orb sa-orb-b" />
        <span className="sa-grain" />
      </div>

      <aside className="sa-sidebar">
        <div className="sa-brand-lockup">
          <span className="sa-mark">A</span>
          <div>
            <strong>AfterSale</strong>
            <span>Super Admin</span>
          </div>
        </div>

        <nav className="sa-nav">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="sa-nav-link" data-active={active}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sa-sidebar-foot">
          <ThemeToggle />
          <button
            type="button"
            className="sa-btn sa-btn-ghost"
            onClick={() => {
              localStorage.removeItem("aftersale_admin_token");
              router.push("/");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="sa-main">
        <header className="sa-page-head">
          <div>
            <p className="sa-kicker">Internal console</p>
            <h1>{title}</h1>
            {lede ? <p className="sa-lede">{lede}</p> : null}
          </div>
          {actions ? <div className="sa-page-actions">{actions}</div> : null}
        </header>
        {children}
      </main>
    </div>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "ok" | "warn" | "bad" | "info" | "neutral";
  children: ReactNode;
}) {
  return <span className={`sa-pill sa-pill-${tone}`}>{children}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "ok" | "warn" | "bad" | "info";
}) {
  return (
    <article className="sa-stat" data-tone={tone}>
      <p className="sa-stat-label">{label}</p>
      <p className="sa-stat-value">{value}</p>
      {hint ? <p className="sa-stat-hint">{hint}</p> : null}
    </article>
  );
}

export function Panel({
  title,
  children,
  toolbar,
}: {
  title?: string;
  children: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <section className="sa-panel">
      {title || toolbar ? (
        <div className="sa-panel-head">
          {title ? <h2>{title}</h2> : <span />}
          {toolbar}
        </div>
      ) : null}
      {children}
    </section>
  );
}
