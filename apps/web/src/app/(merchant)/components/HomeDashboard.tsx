"use client";

import { useEffect, useState } from "react";
import { Badge, Banner, Layout, Page, Text } from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { appHref } from "@/lib/shop-context";
import { shouldAutoStartWelcome } from "@/lib/tours";
import { TourTrigger, useOptionalTour } from "./ProductTour";

type HomeData = {
  home: {
    shop: {
      shopName: string | null;
      shopDomain: string;
      onboardingCompleted: boolean;
      needsPlanSelection: boolean;
      plan: { name: string; slug: string; warrantiesPerMonth: number; claimsPerMonth: number } | null;
      usage: { metric: string; used: number; limit: number }[];
    };
    kpis: {
      openClaims: number;
      awaitingAction: number;
      activeWarranties: number;
      expiringThisMonth: number;
      claimRate30d: number;
    };
    needsAttention: { id: string; title: string; href?: string | null }[];
    setupChecklist: { id: string; title: string; href?: string | null }[];
  };
};

const HOME_QUERY = `#graphql
  query Home {
    home {
      shop {
        shopName
        shopDomain
        onboardingCompleted
        needsPlanSelection
        plan { name slug warrantiesPerMonth claimsPerMonth }
        usage { metric used limit }
      }
      kpis {
        openClaims
        awaitingAction
        activeWarranties
        expiringThisMonth
        claimRate30d
      }
      needsAttention { id title href }
      setupChecklist { id title href }
    }
  }
`;

export function HomeDashboard() {
  const [data, setData] = useState<HomeData["home"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tour = useOptionalTour();

  useEffect(() => {
    gqlRequest<HomeData>(HOME_QUERY)
      .then((d) => setData(d.home))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !data || !tour) return;
    if (!shouldAutoStartWelcome()) return;
    const t = window.setTimeout(() => tour.startTour("welcome"), 700);
    return () => window.clearTimeout(t);
  }, [loading, data, tour]);

  if (loading) {
    return (
      <Page title="AfterSale OS">
        <div className="as-m-skeleton">
          <div className="as-m-skel as-m-skel-hero" />
          <div className="as-m-skel-row">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="as-m-skel as-m-skel-kpi" />
            ))}
          </div>
        </div>
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page title="AfterSale OS">
        <Banner tone="critical" title="Could not load dashboard">
          <p>{error ?? "Unknown error"}</p>
        </Banner>
      </Page>
    );
  }

  const warrantyUsage = data.shop.usage.find((u) => u.metric === "warranties_created");
  const claimUsage = data.shop.usage.find((u) => u.metric === "claims_created");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const shopLabel = data.shop.shopName ?? data.shop.shopDomain;

  return (
    <Page
      title={shopLabel}
      subtitle="AfterSale OS command center"
      titleMetadata={
        data.shop.plan ? (
          <Badge tone="info">{data.shop.plan.name}</Badge>
        ) : (
          <Badge>Choose a plan</Badge>
        )
      }
      secondaryActions={[
        { content: "Claims", url: appHref("/claims") },
        { content: "Warranties", url: appHref("/warranties") },
        { content: "Customer pages", url: appHref("/settings") },
        { content: "Plans", url: appHref("/plans") },
      ]}
    >
      <Layout>
        <Layout.Section>
          <div className="as-m-hero">
            <div className="as-m-hero-kicker">
              <span className="as-m-hero-dot" />
              Overview
            </div>
            <h2>
              {greeting}
              {data.shop.shopName ? `, ${data.shop.shopName}` : ""}
            </h2>
            <p>
              Track warranties and claims without blocking customers when you hit plan limits.
            </p>
            <div className="as-m-hero-actions">
              <a className="as-m-chip as-m-chip-accent" href={appHref("/claims/new")}>
                New claim
              </a>
              <a className="as-m-chip" href={appHref("/warranties")} data-tour="hero-warranties">
                Warranties
              </a>
              <a className="as-m-chip" href={appHref("/settings")} data-tour="hero-customer-pages">
                Customer pages
              </a>
              <TourTrigger tourId="welcome" label="Take welcome tour" />
              <a className="as-m-chip" href={appHref("/plans")}>
                {data.shop.plan ? data.shop.plan.name : "Choose plan"}
              </a>
            </div>
          </div>
        </Layout.Section>

        {data.setupChecklist.length > 0 ? (
          <Layout.Section>
            <div className="as-m-panel" data-tour="setup-checklist">
              <div className="as-m-panel-title">
                <h3>Finish setup</h3>
                <Badge tone="attention">{`${data.setupChecklist.length} left`}</Badge>
              </div>
              <div className="as-m-list">
                {data.setupChecklist.map((item, i) => (
                  <a
                    key={item.id}
                    className="as-m-list-item"
                    href={item.href ? appHref(item.href) : "#"}
                  >
                    <span className="as-m-list-icon">{String(i + 1).padStart(2, "0")}</span>
                    <span className="as-m-list-body">
                      <strong>{item.title}</strong>
                      <span>Recommended before go-live</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <div className="as-m-kpi-grid">
            <Kpi label="Open claims" value={data.kpis.openClaims} hint="In workflow" />
            <Kpi label="Awaiting action" value={data.kpis.awaitingAction} hint="Needs your team" />
            <Kpi label="Active warranties" value={data.kpis.activeWarranties} hint="Coverage live" />
            <Kpi
              label="Expiring soon"
              value={data.kpis.expiringThisMonth}
              accent
              hint="This month"
            />
            <Kpi
              label="Claim rate 30d"
              value={`${data.kpis.claimRate30d.toFixed(1)}%`}
              hint="Rolling window"
            />
          </div>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <div className="as-m-panel" style={{ animationDelay: "0.12s" }}>
            <div className="as-m-panel-title">
              <h3>Needs attention</h3>
              <Badge>{String(data.needsAttention.length)}</Badge>
            </div>
            {data.needsAttention.length === 0 ? (
              <div className="as-m-empty">Nothing waiting. You are caught up.</div>
            ) : (
              <div className="as-m-list">
                {data.needsAttention.map((item) => (
                  <a
                    key={item.id}
                    className="as-m-list-item"
                    href={item.href ? appHref(item.href) : "#"}
                  >
                    <span className="as-m-list-icon" data-tone="warn">
                      !
                    </span>
                    <span className="as-m-list-body">
                      <strong>{item.title}</strong>
                      <span>Open item</span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <div className="as-m-panel" style={{ animationDelay: "0.16s" }}>
            <div className="as-m-panel-title">
              <h3>Plan usage</h3>
              <a className="as-m-chip" href={appHref("/plans")}>
                Manage
              </a>
            </div>
            {warrantyUsage ? (
              <Meter label="Warranties this month" used={warrantyUsage.used} limit={warrantyUsage.limit} />
            ) : (
              <Text as="p" tone="subdued">
                No warranty usage yet this period.
              </Text>
            )}
            {claimUsage ? (
              <Meter label="Claims this month" used={claimUsage.used} limit={claimUsage.limit} />
            ) : null}
            <div className="as-m-hero-actions" style={{ marginTop: 8 }}>
              <a className="as-m-chip" href={appHref("/settings")}>
                Customer pages
              </a>
              <a className="as-m-chip" href={appHref("/automations")}>
                Automations
              </a>
            </div>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function Kpi({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="as-m-kpi">
      <div className="as-m-kpi-label">{label}</div>
      <div className="as-m-kpi-value" data-accent={accent ? "true" : "false"}>
        {value}
      </div>
      {hint ? <div className="as-m-kpi-hint">{hint}</div> : null}
    </div>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="as-m-meter">
      <div className="as-m-meter-head">
        <span>{label}</span>
        <span>
          {used} / {limit}
        </span>
      </div>
      <div className="as-m-meter-track">
        <div
          className="as-m-meter-fill"
          data-critical={pct >= 90 ? "true" : "false"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
