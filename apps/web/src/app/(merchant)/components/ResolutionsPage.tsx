"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  DataTable,
  InlineStack,
  Page,
  Select,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { appHref } from "@/lib/shop-context";
import { PageEmpty, PageLoading } from "./PageLoading";

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
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    gqlRequest<{ replacements: Replacement[]; resolutions: Resolution[] }>(QUERY)
      .then((d) => {
        setReplacements(d.replacements);
        setResolutions(d.resolutions);
        setHasLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
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
    <Page
      title="Resolutions"
      subtitle={hasLoaded ? `${replacements.length + resolutions.length} records` : "Loading…"}
    >
      <div className="as-m-ops-surface">
        {error ? (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        ) : null}

        <div className="as-m-ops-banner">
          <div>
            <p className="as-m-ops-kicker">Operations</p>
            <h2>Replacements & refunds</h2>
            <p>Track draft orders, refunds, and other claim resolutions in one place.</p>
          </div>
          <Button onClick={load} loading={loading && hasLoaded} disabled={loading && !hasLoaded}>
            Refresh
          </Button>
        </div>

        {loading && !hasLoaded ? (
          <PageLoading label="Loading resolutions" />
        ) : (
          <>
            <div className="as-m-ops-card">
              <h3>Replacement draft orders</h3>
              {replacements.length === 0 ? (
                <PageEmpty
                  title="No replacements yet"
                  body="Create a replacement from a claim’s Resolve tab."
                  action={<Button url={appHref("/claims")}>Open claims</Button>}
                />
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                  headings={["Claim", "Product", "Draft", "Warranty", "Status", ""]}
                  rows={replacements.map((r) => [
                    <Button key={`c-${r.id}`} url={appHref(`/claims/${r.claimId}`)} variant="plain">
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
              )}
            </div>

            <div className="as-m-ops-card">
              <InlineStack align="space-between" blockAlign="center">
                <h3 style={{ margin: 0 }}>Resolution log</h3>
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
              {filtered.length === 0 ? (
                <PageEmpty title="No resolution log entries" body="Refunds and other resolutions will appear here." />
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                  headings={["Claim", "Type", "Amount", "Reason", "Shopify", "When"]}
                  rows={filtered.map((r) => [
                    <Button key={`rc-${r.id}`} url={appHref(`/claims/${r.claimId}`)} variant="plain">
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
              )}
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
