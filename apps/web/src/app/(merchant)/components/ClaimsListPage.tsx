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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    gqlRequest<{ claims: { total: number; nodes: ClaimRow[] } }>(LIST, {
      status: status || null,
      query: query || null,
    })
      .then((d) => {
        setNodes(d.claims.nodes);
        setTotal(d.claims.total);
      })
      .catch((e) => setError(friendlyError(e)));
  }, [status, query]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Page
      title="Claims"
      subtitle={`${total} total`}
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
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="300">
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
                />
                <Button onClick={load}>Refresh</Button>
              </InlineStack>

              {nodes.length === 0 ? (
                <BlockStack gap="200">
                  <Text as="p" tone="subdued">
                    No claims match this view yet.
                  </Text>
                  <Text as="p" tone="subdued">
                    Customers submit via Customer pages → claim form, theme claim block, or you can
                    create one with New claim. Publish a warranty rule first so eligibility has coverage
                    to check.
                  </Text>
                  <InlineStack gap="200">
                    <Button url={appHref("/claims/new")}>New claim</Button>
                    <Button url={appHref("/settings")}>Customer pages</Button>
                  </InlineStack>
                </BlockStack>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
                  headings={["Claim", "Customer", "Product", "Summary", "Eligibility", "Status", "Opened"]}
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
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
