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
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";

type Replacement = {
  id: string;
  claimId: string;
  claimNumber: string | null;
  status: string;
  shopifyDraftOrderName: string | null;
  productTitle: string | null;
  warrantyMode: string;
  adminOrderUrl: string | null;
  createdAt: string;
};

type Resolution = {
  id: string;
  claimId: string;
  claimNumber: string | null;
  type: string;
  amountCents: number | null;
  currency: string;
  reason: string | null;
  issuedInShopify: boolean;
  adminDeepLink: string | null;
  createdAt: string;
};

const QUERY = `#graphql
  query Resolutions {
    replacements(limit: 100) {
      id claimId claimNumber status shopifyDraftOrderName productTitle
      warrantyMode adminOrderUrl createdAt
    }
    resolutions(limit: 100) {
      id claimId claimNumber type amountCents currency reason
      issuedInShopify adminDeepLink createdAt
    }
  }
`;

export function ResolutionsPage() {
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    gqlRequest<{ replacements: Replacement[]; resolutions: Resolution[] }>(QUERY)
      .then((d) => {
        setReplacements(d.replacements);
        setResolutions(d.resolutions);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function completeReplacement(id: string) {
    setBusy(id);
    try {
      await gqlRequest(
        `#graphql
        mutation C($id: ID!) {
          completeReplacement(id: $id) { id status }
        }`,
        { id },
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const filtered = typeFilter
    ? resolutions.filter((r) => r.type === typeFilter)
    : resolutions;

  return (
    <Page title="Resolutions" subtitle="Replacements and refunds">
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Replacement draft orders
              </Text>
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["Claim", "Product", "Draft", "Warranty", "Status", ""]}
                rows={replacements.map((r) => [
                  <Button key={`c-${r.id}`} url={`/claims/${r.claimId}`} variant="plain">
                    {r.claimNumber ?? r.claimId}
                  </Button>,
                  r.productTitle ?? "—",
                  r.adminOrderUrl ? (
                    <Button url={r.adminOrderUrl} external variant="plain">
                      {r.shopifyDraftOrderName ?? "Open draft"}
                    </Button>
                  ) : (
                    r.shopifyDraftOrderName ?? "—"
                  ),
                  r.warrantyMode.replaceAll("_", " "),
                  <Badge key={`b-${r.id}`}>{r.status}</Badge>,
                  r.status === "draft_created" ? (
                    <Button
                      key={`done-${r.id}`}
                      size="slim"
                      loading={busy === r.id}
                      onClick={() => completeReplacement(r.id)}
                    >
                      Mark completed
                    </Button>
                  ) : (
                    ""
                  ),
                ])}
              />
              {replacements.length === 0 ? (
                <Text as="p" tone="subdued">
                  No replacements yet. Create one from a claim.
                </Text>
              ) : null}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Resolution log
                </Text>
                <div style={{ minWidth: 180 }}>
                  <Select
                    label="Type"
                    labelHidden
                    options={[
                      { label: "All types", value: "" },
                      { label: "Repair", value: "REPAIR" },
                      { label: "Replacement", value: "REPLACEMENT" },
                      { label: "Refund", value: "REFUND" },
                      { label: "Other", value: "OTHER" },
                    ]}
                    value={typeFilter}
                    onChange={setTypeFilter}
                  />
                </div>
              </InlineStack>
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["Claim", "Type", "Amount", "Reason", "Shopify", "When"]}
                rows={filtered.map((r) => [
                  <Button key={`rc-${r.id}`} url={`/claims/${r.claimId}`} variant="plain">
                    {r.claimNumber ?? r.claimId}
                  </Button>,
                  r.type,
                  r.amountCents != null
                    ? `${(r.amountCents / 100).toFixed(2)} ${r.currency}`
                    : "—",
                  r.reason ?? "—",
                  r.adminDeepLink ? (
                    <Button url={r.adminDeepLink} external variant="plain">
                      {r.issuedInShopify ? "Issued" : "Open"}
                    </Button>
                  ) : r.issuedInShopify ? (
                    "Yes"
                  ) : (
                    "Recorded"
                  ),
                  new Date(r.createdAt).toLocaleString(),
                ])}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
