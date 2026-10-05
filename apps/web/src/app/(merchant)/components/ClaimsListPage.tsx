"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { friendlyError } from "@/lib/merchant-errors";
import { appHref } from "@/lib/shop-context";
import { BrandLoader } from "./BrandLoader";
import { PageEmpty } from "./PageLoading";

type ClaimRow = {
  id: string;
  claimNumber: string;
  status: string;
  customerEmail: string | null;
  issueSummary: string | null;
  eligibilityLabel: string;
  productTitle: string | null;
  slaDueAt: string | null;
  createdAt: string;
};

const LIST = `#graphql
  query Claims($status: String, $query: String) {
    claims(status: $status, query: $query, limit: 50) {
      total
      nodes {
        id claimNumber status customerEmail issueSummary eligibilityLabel
        productTitle slaDueAt createdAt
      }
    }
  }
`;

function tone(status: string): "success" | "attention" | "critical" | "info" | undefined {
  if (status === "APPROVED" || status === "COMPLETED") return "success";
  if (status === "REJECTED" || status === "CANCELLED") return "critical";
  if (status === "WAITING_CUSTOMER") return "attention";
  if (status === "IN_REVIEW" || status === "OPEN") return "info";
  return undefined;
}

export function ClaimsListPage() {
  const [nodes, setNodes] = useState<ClaimRow[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    gqlRequest<{ claims: { total: number; nodes: ClaimRow[] } }>(LIST, {
      status: status || null,
      query: debouncedQuery || null,
    })
      .then((d) => {
        setNodes(d.claims.nodes);
        setTotal(d.claims.total);
        setHasLoaded(true);
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, [status, debouncedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const showInitialLoader = loading && !hasLoaded;
  const showEmpty = hasLoaded && !loading && nodes.length === 0;

  return (
    <Page
      title="Claims"
      subtitle={hasLoaded ? `${total} total` : "Loading…"}
      primaryAction={{ content: "New claim", url: appHref("/claims/new") }}
    >
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        ) : null}
        <Layout.Section>
          <div className="as-m-ops-banner" style={{ marginBottom: 14 }}>
            <div>
              <p className="as-m-ops-kicker">Operations</p>
              <h2>Claims inbox</h2>
              <p>Search, filter, and open claims without losing your place.</p>
            </div>
          </div>
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="300" blockAlign="end">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Search"
                    labelHidden
                    value={query}
                    onChange={setQuery}
                    autoComplete="off"
                    placeholder="Claim #, email, summary…"
                    clearButton
                    onClearButtonClick={() => setQuery("")}
                    disabled={showInitialLoader}
                  />
                </div>
                <Select
                  label="Status"
                  labelHidden
                  options={[
                    { label: "All statuses", value: "" },
                    { label: "Open", value: "OPEN" },
                    { label: "In review", value: "IN_REVIEW" },
                    { label: "Waiting customer", value: "WAITING_CUSTOMER" },
                    { label: "Approved", value: "APPROVED" },
                    { label: "Rejected", value: "REJECTED" },
                    { label: "In resolution", value: "IN_RESOLUTION" },
                    { label: "Completed", value: "COMPLETED" },
                  ]}
                  value={status}
                  onChange={setStatus}
                  disabled={showInitialLoader}
                />
                <Button onClick={load} loading={loading && hasLoaded} disabled={showInitialLoader}>
                  Refresh
                </Button>
              </InlineStack>

              {showInitialLoader ? (
                <div style={{ padding: "36px 0" }}>
                  <BrandLoader label="Loading claims" compact />
                </div>
              ) : showEmpty ? (
                <PageEmpty
                  title="No claims match this view yet"
                  body="Customers submit via Customer pages → claim form, or create one with New claim."
                  action={
                    <>
                      <Button url={appHref("/claims/new")}>New claim</Button>
                      <Button url={appHref("/settings")}>Customer pages</Button>
                    </>
                  }
                />
              ) : (
                <div className={loading ? "as-m-list-refreshing" : undefined}>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
                    headings={[
                      "Claim",
                      "Customer",
                      "Product",
                      "Summary",
                      "Eligibility",
                      "Status",
                      "Opened",
                    ]}
                    rows={nodes.map((c) => [
                      <Button key={c.id} variant="plain" url={appHref(`/claims/${c.id}`)}>
                        {c.claimNumber}
                      </Button>,
                      c.customerEmail ?? "—",
                      c.productTitle ?? "—",
                      c.issueSummary ?? "—",
                      c.eligibilityLabel,
                      <Badge key={`s-${c.id}`} tone={tone(c.status)}>
                        {c.status}
                      </Badge>,
                      new Date(c.createdAt).toLocaleDateString(),
                    ])}
                  />
                </div>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
