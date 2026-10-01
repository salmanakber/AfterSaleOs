"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Link,
  Page,
  ProgressBar,
  Text,
} from "@shopify/polaris";
import { theme } from "@aftersale/shared";
import { gqlRequest } from "@/lib/graphql";

type HomeData = {
  home: {
    shop: {
      shopName: string | null;
      shopDomain: string;
      onboardingCompleted: boolean;
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

  useEffect(() => {
    gqlRequest<HomeData>(HOME_QUERY)
      .then((d) => setData(d.home))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Page title="AfterSale OS">
        <Text as="p">Loading dashboard…</Text>
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page title="AfterSale OS">
        <Banner tone="critical" title="Could not load dashboard">
          <p>{error ?? "Unknown error"}</p>
          <p>If you are not embedded yet, open with ?shop=your-store.myshopify.com after OAuth.</p>
        </Banner>
      </Page>
    );
  }

  const warrantyUsage = data.shop.usage.find((u) => u.metric === "warranties_created");
  const claimUsage = data.shop.usage.find((u) => u.metric === "claims_created");

  return (
    <Page
      title={data.shop.shopName ?? "AfterSale OS"}
      subtitle={data.shop.shopDomain}
      titleMetadata={
        data.shop.plan ? <Badge tone="info">{data.shop.plan.name}</Badge> : undefined
      }
      secondaryActions={[{ content: "Plans & Usage", url: "/plans" }]}
    >
      <Layout>
        {data.setupChecklist.length > 0 ? (
          <Layout.Section>
            <Banner title="Setup checklist" tone="info">
              <BlockStack gap="200">
                {data.setupChecklist.map((item) => (
                  <Text as="p" key={item.id}>
                    {item.href ? <Link url={item.href}>{item.title}</Link> : item.title}
                  </Text>
                ))}
              </BlockStack>
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 3, lg: 5 }} gap="400">
            <KpiCard label="Open claims" value={String(data.kpis.openClaims)} />
            <KpiCard label="Awaiting action" value={String(data.kpis.awaitingAction)} />
            <KpiCard label="Active warranties" value={String(data.kpis.activeWarranties)} />
            <KpiCard label="Expiring this month" value={String(data.kpis.expiringThisMonth)} accent />
            <KpiCard label="Claim rate (30d)" value={`${data.kpis.claimRate30d.toFixed(1)}%`} />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Needs attention
              </Text>
              {data.needsAttention.length === 0 ? (
                <Text as="p" tone="subdued">
                  Nothing waiting right now. You are caught up.
                </Text>
              ) : (
                data.needsAttention.map((item) => (
                  <Text as="p" key={item.id}>
                    {item.href ? <Link url={item.href}>{item.title}</Link> : item.title}
                  </Text>
                ))
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Plan usage
              </Text>
              {warrantyUsage ? (
                <Meter label="Warranties this month" used={warrantyUsage.used} limit={warrantyUsage.limit} />
              ) : null}
              {claimUsage ? (
                <Meter label="Claims this month" used={claimUsage.used} limit={claimUsage.limit} />
              ) : null}
              <Text as="p" tone="subdued">
                Customer claim and registration submissions are never blocked by plan limits.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" tone="subdued" variant="bodySm">
          {label}
        </Text>
        <Text as="p" variant="headingLg" fontWeight="bold">
          <span style={accent ? { color: theme.status.expiring } : undefined}>{value}</span>
        </Text>
      </BlockStack>
    </Card>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <BlockStack gap="150">
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
