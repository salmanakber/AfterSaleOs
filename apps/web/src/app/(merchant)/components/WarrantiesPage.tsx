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
  Modal,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { theme } from "@aftersale/shared";
import { gqlRequest } from "@/lib/graphql";

type Warranty = {
  id: string;
  status: string;
  source: string;
  startAt: string | null;
  endAt: string | null;
  customerEmail: string | null;
  productTitle: string;
  orderNumber: string;
  serialNumber: string | null;
  ruleName: string;
  warrantyType: string;
};

type Job = {
  id: string;
  status: string;
  progress: number;
  result: string | null;
  errorSummary: string | null;
  createdAt: string;
};

type Rule = { id: string; name: string };

const PAGE_QUERY = `#graphql
  query WarrantiesPage($query: String, $status: String) {
    warranties(query: $query, status: $status, limit: 50) {
      total
      nodes {
        id status source startAt endAt customerEmail productTitle orderNumber
        serialNumber ruleName warrantyType
      }
    }
    jobs(type: "backfill", limit: 5) {
      id status progress result errorSummary createdAt
    }
    warrantyRules { id name }
  }
`;

const START_BACKFILL = `#graphql
  mutation StartBackfill($months: Int!) {
    startBackfill(lookbackMonths: $months) { id status }
  }
`;

const CREATE_MANUAL = `#graphql
  mutation Manual($input: ManualWarrantyInput!) {
    createManualWarranty(input: $input) { id }
  }
`;

const VOID = `#graphql
  mutation Void($id: ID!, $reason: String!) {
    voidWarranty(id: $id, reason: $reason) { id status }
  }
`;

const EXTEND = `#graphql
  mutation Extend($id: ID!, $extraMonths: Int!, $reason: String!) {
    extendWarranty(id: $id, extraMonths: $extraMonths, reason: $reason) { id endAt status }
  }
`;

function statusTone(status: string): "success" | "attention" | "info" | "critical" | undefined {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "EXPIRING_SOON":
      return "attention";
    case "PENDING_START":
    case "PENDING_VERIFICATION":
      return "info";
    case "VOID":
      return "critical";
    default:
      return undefined;
  }
}

export function WarrantiesPage() {
  const [nodes, setNodes] = useState<Warranty[]>([]);
  const [total, setTotal] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [lookback, setLookback] = useState("12");
  const [busy, setBusy] = useState(false);

  const [mEmail, setMEmail] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [mRuleId, setMRuleId] = useState("");
  const [mPurchase, setMPurchase] = useState(new Date().toISOString().slice(0, 10));
  const [mReason, setMReason] = useState("Manual coverage");

  const load = useCallback(() => {
    gqlRequest<{
      warranties: { total: number; nodes: Warranty[] };
      jobs: Job[];
      warrantyRules: Rule[];
    }>(PAGE_QUERY, { query: query || null, status: status || null })
      .then((d) => {
        setNodes(d.warranties.nodes);
        setTotal(d.warranties.total);
        setJobs(d.jobs);
        setRules(d.warrantyRules);
        if (!mRuleId && d.warrantyRules[0]) setMRuleId(d.warrantyRules[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [query, status, mRuleId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runBackfill() {
    setBusy(true);
    try {
      await gqlRequest(START_BACKFILL, { months: Number(lookback) });
      setBackfillOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBusy(false);
    }
  }

  async function createManual() {
    setBusy(true);
    try {
      await gqlRequest(CREATE_MANUAL, {
        input: {
          customerEmail: mEmail || null,
          productTitle: mTitle,
          ruleId: mRuleId,
          purchaseAt: new Date(mPurchase).toISOString(),
          reason: mReason,
        },
      });
      setManualOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function voidOne(id: string) {
    const reason = window.prompt("Void reason?");
    if (!reason) return;
    try {
      await gqlRequest(VOID, { id, reason });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Void failed");
    }
  }

  async function extendOne(id: string) {
    const months = window.prompt("Extend by how many months?", "3");
    if (!months) return;
    const reason = window.prompt("Reason for extension?", "Goodwill extension") ?? "Extended";
    try {
      await gqlRequest(EXTEND, { id, extraMonths: Number(months), reason });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extend failed");
    }
  }

  const rows = nodes.map((w) => [
    w.orderNumber,
    w.productTitle,
    w.customerEmail ?? "—",
    w.serialNumber ?? "—",
    <Badge key={w.id} tone={statusTone(w.status)}>
      {w.status}
    </Badge>,
    w.ruleName,
    w.startAt ? new Date(w.startAt).toLocaleDateString() : "—",
    w.endAt ? new Date(w.endAt).toLocaleDateString() : "Lifetime",
    <InlineStack key={`a-${w.id}`} gap="100">
      <Button variant="plain" onClick={() => extendOne(w.id)}>
        Extend
      </Button>
      <Button tone="critical" variant="plain" onClick={() => voidOne(w.id)}>
        Void
      </Button>
    </InlineStack>,
  ]);

  const latestJob = jobs[0];

  return (
    <Page
      title="Warranties"
      subtitle={`${total} total`}
      primaryAction={{ content: "Create manual", onAction: () => setManualOpen(true) }}
      secondaryActions={[{ content: "Run backfill", onAction: () => setBackfillOpen(true) }]}
    >
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        ) : null}

        {latestJob ? (
          <Layout.Section>
            <Banner
              tone={
                latestJob.status === "FAILED"
                  ? "critical"
                  : latestJob.status === "COMPLETED"
                    ? "success"
                    : "info"
              }
              title={`Backfill ${latestJob.status.toLowerCase()}`}
            >
              <p>
                Progress: {latestJob.progress}
                {latestJob.result ? ` · ${latestJob.result}` : ""}
                {latestJob.errorSummary ? ` · ${latestJob.errorSummary}` : ""}
              </p>
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
                    placeholder="Order, email, serial…"
                    value={query}
                    onChange={setQuery}
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setQuery("")}
                  />
                </div>
                <Select
                  label="Status"
                  labelHidden
                  options={[
                    { label: "All statuses", value: "" },
                    { label: "Active", value: "ACTIVE" },
                    { label: "Pending start", value: "PENDING_START" },
                    { label: "Expiring soon", value: "EXPIRING_SOON" },
                    { label: "Expired", value: "EXPIRED" },
                    { label: "Void", value: "VOID" },
                  ]}
                  value={status}
                  onChange={setStatus}
                />
                <Button onClick={load}>Refresh</Button>
              </InlineStack>

              {nodes.length === 0 ? (
                <Text as="p" tone="subdued">
                  No warranties yet. Create a rule, then run backfill or wait for new orders.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                  ]}
                  headings={[
                    "Order",
                    "Product",
                    "Customer",
                    "Serial",
                    "Status",
                    "Rule",
                    "Start",
                    "End",
                    "",
                  ]}
                  rows={rows}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={backfillOpen}
        onClose={() => setBackfillOpen(false)}
        title="Historical backfill"
        primaryAction={{ content: "Start", onAction: runBackfill, loading: busy }}
        secondaryActions={[{ content: "Cancel", onAction: () => setBackfillOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">
              Import orders and create per-unit warranties. Without Shopify{" "}
              <span style={{ color: theme.light.primary }}>read_all_orders</span> approval, only
              recent orders (~60 days) may be available.
            </Text>
            <Select
              label="Lookback"
              options={[
                { label: "12 months", value: "12" },
                { label: "24 months", value: "24" },
                { label: "All available", value: "0" },
              ]}
              value={lookback}
              onChange={setLookback}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Create manual warranty"
        primaryAction={{ content: "Create", onAction: createManual, loading: busy }}
        secondaryActions={[{ content: "Cancel", onAction: () => setManualOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField label="Product title" value={mTitle} onChange={setMTitle} autoComplete="off" />
            <TextField
              label="Customer email"
              value={mEmail}
              onChange={setMEmail}
              autoComplete="email"
            />
            <Select
              label="Rule"
              options={rules.map((r) => ({ label: r.name, value: r.id }))}
              value={mRuleId}
              onChange={setMRuleId}
            />
            <TextField
              label="Purchase date"
              type="date"
              value={mPurchase}
              onChange={setMPurchase}
              autoComplete="off"
            />
            <TextField label="Reason" value={mReason} onChange={setMReason} autoComplete="off" />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
