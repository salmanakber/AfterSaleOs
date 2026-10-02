"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Banner, Button, Layout, Page, Text } from "@shopify/polaris";
import { clearSessionTokenCache, merchantAuthHeaders } from "@/lib/session-token";
import { appHref } from "@/lib/shop-context";
import { gqlRequest } from "@/lib/graphql";

type Plan = {
  id: string;
  name: string;
  slug: string;
  priceMonthlyCents: number;
  warrantiesPerMonth: number;
  claimsPerMonth: number;
  aiCreditsPerMonth: number;
  isFree: boolean;
};

type BillingPayload = {
  current: Plan | null;
  billingStatus: string;
  needsPlanSelection?: boolean;
  billingTestMode?: boolean;
  charges: { id: string; status: string; amountCents: number }[];
  plans: Plan[];
  error?: string;
};

type UsageMeter = { metric: string; used: number; limit: number };

async function billingFetch(init?: RequestInit & { sync?: boolean }): Promise<Response> {
  async function once(): Promise<Response> {
    const headers = await merchantAuthHeaders(init?.headers as Record<string, string> | undefined);
    const qs = init?.sync ? "?sync=1" : "";
    const { sync: _s, ...rest } = init ?? {};
    return fetch(`/api/billing${qs}`, { ...rest, headers });
  }

  let res = await once();
  if (res.status === 401) {
    clearSessionTokenCache();
    res = await once();
  }
  return res;
}

export function PlansPage() {
  const router = useRouter();
  const search = useSearchParams();
  const welcome = search.get("welcome") === "1";
  const billingReturn = search.get("billing") === "return";

  const [data, setData] = useState<BillingPayload | null>(null);
  const [usage, setUsage] = useState<UsageMeter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const load = useCallback(async (opts?: { sync?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await billingFetch({ sync: opts?.sync || billingReturn });
      const json = (await res.json()) as BillingPayload;
      if (!res.ok) throw new Error(json.error ?? "Failed to load billing");
      setData(json);

      if (billingReturn && (json.current?.slug || json.billingStatus === "ACTIVE")) {
        router.replace(appHref("/"));
        return;
      }

      try {
        const home = await gqlRequest<{ home: { shop: { usage: UsageMeter[] } } }>(
          `#graphql
          query PlansUsage {
            home { shop { usage { metric used limit } } }
          }`,
        );
        setUsage(home.home.shop.usage);
      } catch {
        setUsage([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [billingReturn, router]);

  useEffect(() => {
    void load({ sync: billingReturn });
  }, [load, billingReturn]);

  // Poll briefly after returning from Shopify charge approval.
  useEffect(() => {
    if (!billingReturn || data?.current?.slug) return;
    const id = window.setInterval(() => {
      void load({ sync: true });
    }, 2500);
    const stop = window.setTimeout(() => window.clearInterval(id), 20000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [billingReturn, data?.current?.slug, load]);

  const featuredSlug = useMemo(() => {
    const growth = data?.plans.find((p) => p.slug === "growth");
    return growth?.slug ?? data?.plans.find((p) => !p.isFree)?.slug ?? null;
  }, [data?.plans]);

  async function selectPlan(planSlug: string) {
    setBusySlug(planSlug);
    setError(null);
    try {
      const res = await billingFetch({
        method: "POST",
        body: JSON.stringify({ planSlug }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        confirmationUrl?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Billing request failed");
      if (json.confirmationUrl) {
        window.open(json.confirmationUrl, "_top");
        return;
      }
      await load();
      if (welcome) {
        router.replace(appHref("/"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Billing error");
    } finally {
      setBusySlug(null);
    }
  }

  if (loading && !data) {
    return (
      <Page title="Plans & Usage">
        <div className="as-m-skeleton">
          <div className="as-m-skel as-m-skel-hero" />
          <div className="as-m-skel-row">
            {[0, 1, 2].map((i) => (
              <div key={i} className="as-m-skel as-m-skel-kpi" style={{ height: 220 }} />
            ))}
          </div>
        </div>
      </Page>
    );
  }

  if (error && !data) {
    return (
      <Page title="Plans & Usage">
        <Banner tone="critical" title="Could not load plans">
          <p>{error}</p>
        </Banner>
      </Page>
    );
  }

  const current = data?.current ?? null;
  const forcePick = welcome || data?.needsPlanSelection;

  return (
    <Page
      title={forcePick ? "Choose your plan" : "Plans & Usage"}
      subtitle={
        forcePick
          ? "Pick a plan to unlock the dashboard. You can change later."
          : current
            ? `Current: ${current.name}`
            : "No plan assigned"
      }
      titleMetadata={
        data?.billingStatus ? <Badge tone="info">{data.billingStatus}</Badge> : undefined
      }
    >
      <div className={forcePick ? "as-m-welcome" : undefined}>
        <Layout>
          {forcePick ? (
            <Layout.Section>
              <div className="as-m-hero">
                <div className="as-m-hero-grid" aria-hidden />
                <div className="as-m-hero-kicker">
                  <span className="as-m-hero-dot" />
                  Welcome to AfterSale OS
                </div>
                <h2>Start with the plan that fits your volume</h2>
                <p>
                  Free works for getting started. Upgrade anytime for repairs, replacements, and
                  deeper automation. Customer claims are never blocked by limits.
                </p>
              </div>
            </Layout.Section>
          ) : null}

          {billingReturn && !current ? (
            <Layout.Section>
              <Banner tone="info" title="Confirming your subscription…">
                <p>Shopify approved the charge — we are syncing your plan now.</p>
              </Banner>
            </Layout.Section>
          ) : null}

          {error ? (
            <Layout.Section>
              <Banner tone="critical" title="Billing error" onDismiss={() => setError(null)}>
                <p>{error}</p>
              </Banner>
            </Layout.Section>
          ) : null}

          {data?.billingTestMode ? (
            <Layout.Section>
              <Banner tone="warning" title="Shopify billing test mode is on">
                <p>Subscriptions are created as test charges for App Review / sandbox.</p>
              </Banner>
            </Layout.Section>
          ) : null}

          {current && !forcePick ? (
            <Layout.Section>
              <div className="as-m-panel">
                <div className="as-m-panel-title">
                  <h3>Usage this month</h3>
                  <Badge tone="success">{current.name}</Badge>
                </div>
                <Meter
                  label="Warranties"
                  used={usage.find((u) => u.metric === "warranties_created")?.used ?? 0}
                  limit={current.warrantiesPerMonth}
                />
                <Meter
                  label="Claims"
                  used={usage.find((u) => u.metric === "claims_created")?.used ?? 0}
                  limit={current.claimsPerMonth}
                />
                <Meter
                  label="AI credits"
                  used={usage.find((u) => u.metric === "ai_credits")?.used ?? 0}
                  limit={current.aiCreditsPerMonth}
                />
              </div>
            </Layout.Section>
          ) : null}

          <Layout.Section>
            <div className="as-m-plan-grid">
              {(data?.plans ?? []).map((plan, index) => {
                const isCurrent = current?.slug === plan.slug;
                const featured = plan.slug === featuredSlug;
                const price =
                  plan.priceMonthlyCents === 0
                    ? "Free"
                    : `$${(plan.priceMonthlyCents / 100).toFixed(0)}`;
                return (
                  <div
                    key={plan.id}
                    className="as-m-plan"
                    data-featured={featured ? "true" : "false"}
                    style={{ animationDelay: `${index * 0.07}s` }}
                  >
                    {featured ? <span className="as-m-plan-badge">Popular</span> : null}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <h3 className="as-m-plan-name">{plan.name}</h3>
                      {isCurrent ? <Badge tone="success">Current</Badge> : null}
                    </div>
                    <div className="as-m-plan-price">
                      {price}
                      {plan.priceMonthlyCents > 0 ? <span> /mo</span> : null}
                    </div>
                    <Text as="p" tone="subdued">
                      Built for {plan.warrantiesPerMonth.toLocaleString()} warranties / month
                    </Text>
                    <ul className="as-m-plan-features">
                      <li>{plan.warrantiesPerMonth.toLocaleString()} warranties / mo</li>
                      <li>{plan.claimsPerMonth.toLocaleString()} claims / mo</li>
                      <li>{plan.aiCreditsPerMonth.toLocaleString()} AI credits / mo</li>
                      <li>{plan.isFree ? "Core aftercare toolkit" : "Repairs & replacements"}</li>
                    </ul>
                    <Button
                      fullWidth
                      variant={isCurrent ? "secondary" : "primary"}
                      disabled={isCurrent || busySlug !== null}
                      loading={busySlug === plan.slug}
                      onClick={() => void selectPlan(plan.slug)}
                    >
                      {isCurrent
                        ? "Selected"
                        : plan.isFree
                          ? forcePick
                            ? "Start on Free"
                            : "Downgrade to Free"
                          : forcePick
                            ? "Continue with this plan"
                            : "Select plan"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Layout.Section>
        </Layout>
      </div>
    </Page>
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
