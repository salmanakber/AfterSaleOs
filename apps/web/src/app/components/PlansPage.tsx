"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  Text,
} from "@shopify/polaris";
import { getSessionToken, clearSessionTokenCache } from "@/lib/session-token";
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
  charges: { id: string; status: string; amountCents: number }[];
  plans: Plan[];
  error?: string;
};

type UsageMeter = { metric: string; used: number; limit: number };

async function billingFetch(init?: RequestInit): Promise<Response> {
  async function once(): Promise<Response> {
    const token = await getSessionToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const shop = new URLSearchParams(window.location.search).get("shop");
    if (shop) headers["x-aftersale-shop"] = shop;
    return fetch("/api/billing", { ...init, headers });
  }

  let res = await once();
  if (res.status === 401) {
    clearSessionTokenCache();
    res = await once();
  }
  return res;
}

export function PlansPage() {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [usage, setUsage] = useState<UsageMeter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await billingFetch();
      const json = (await res.json()) as BillingPayload;
      if (!res.ok) throw new Error(json.error ?? "Failed to load billing");
      setData(json);
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Billing error");
    } finally {
      setBusySlug(null);
    }
  }

  if (loading) {
    return (
      <Page title="Plans & Usage">
        <Text as="p">Loading plans…</Text>
      </Page>
    );
  }

  if (error && !data) {
    return (
      <Page title="Plans & Usage">
        <Banner tone="critical" title="Could not load plans">
          <p>{error}</p>
          <p>Open with ?shop=your-store.myshopify.com after OAuth.</p>
        </Banner>
      </Page>
    );
  }

  const current = data?.current ?? null;

  return (
    <Page
      title="Plans & Usage"
      subtitle={current ? `Current: ${current.name}` : "No plan assigned"}
      titleMetadata={
        data?.billingStatus ? <Badge tone="info">{data.billingStatus}</Badge> : undefined
      }
    >
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" title="Billing error" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        ) : null}

        {current ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Usage this month
                </Text>
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
                <Text as="p" tone="subdued">
                  Customer claim and registration submissions are never blocked by plan limits.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            {(data?.plans ?? []).map((plan) => {
              const isCurrent = current?.slug === plan.slug;
              const price =
                plan.priceMonthlyCents === 0
                  ? "Free"
                  : `$${(plan.priceMonthlyCents / 100).toFixed(0)}/mo`;
              return (
                <Card key={plan.id}>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingMd">
                        {plan.name}
                      </Text>
                      {isCurrent ? <Badge tone="success">Current</Badge> : null}
                    </InlineStack>
                    <Text as="p" variant="headingLg" fontWeight="bold">
                      {price}
                    </Text>
                    <Text as="p" tone="subdued">
                      {plan.warrantiesPerMonth} warranties · {plan.claimsPerMonth} claims ·{" "}
                      {plan.aiCreditsPerMonth} AI credits
                    </Text>
                    <Button
                      variant={isCurrent ? "secondary" : "primary"}
                      disabled={isCurrent || busySlug !== null}
                      loading={busySlug === plan.slug}
                      onClick={() => void selectPlan(plan.slug)}
                    >
                      {isCurrent ? "Selected" : plan.isFree ? "Downgrade to Free" : "Select plan"}
                    </Button>
                  </BlockStack>
                </Card>
              );
            })}
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between">
        <Text as="span">{label}</Text>
        <Text as="span" tone="subdued">
          {used} / {limit}
        </Text>
      </InlineStack>
      <ProgressBar progress={pct} size="small" tone={pct >= 90 ? "critical" : "primary"} />
    </BlockStack>
  );
}
