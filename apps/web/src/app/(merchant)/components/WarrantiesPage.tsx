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
import { friendlyError } from "@/lib/merchant-errors";

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
  const [success, setSuccess] = useState<string | null>(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [extendMonths, setExtendMonths] = useState("3");
  const [extendReason, setExtendReason] = useState("Goodwill extension");
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
      .catch((e) => setError(friendlyError(e)));
  }, [query, status, mRuleId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runBackfill() {
    setBusy(true);
    try {
      await gqlRequest(START_BACKFILL, { months: Number(lookback) });
      setBackfillOpen(false);
      setSuccess("Backfill job started. Progress appears below.");
      load();
    } catch (e) {
      setError(friendlyError(e, "Backfill failed"));
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
      setSuccess("Manual warranty created.");
      load();
    } catch (e) {
      setError(friendlyError(e, "Create failed"));
    } finally {
      setBusy(false);
    }
  }

  function openVoid(id: string) {
    setActionId(id);
    setVoidReason("");
    setVoidOpen(true);
  }

  function openExtend(id: string) {
    setActionId(id);
    setExtendMonths("3");
    setExtendReason("Goodwill extension");
    setExtendOpen(true);
  }

  async function confirmVoid() {
    if (!actionId || !voidReason.trim()) {
      setError("A void reason is required.");
      return;
    }
    setBusy(true);
    try {
      await gqlRequest(VOID, { id: actionId, reason: voidReason.trim() });
      setVoidOpen(false);
      setSuccess("Warranty voided.");
      load();
    } catch (e) {
      setError(friendlyError(e, "Void failed"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmExtend() {
    if (!actionId) return;
    const months = Number(extendMonths);
    if (!Number.isFinite(months) || months < 1) {
      setError("Enter a valid number of months (1 or more).");
      return;
    }
    setBusy(true);
    try {
      await gqlRequest(EXTEND, {
        id: actionId,
        extraMonths: months,
        reason: extendReason.trim() || "Extended",
      });
      setExtendOpen(false);
      setSuccess(`Warranty extended by ${months} month${months === 1 ? "" : "s"}.`);
      load();
    } catch (e) {
      setError(friendlyError(e, "Extend failed"));
    } finally {
      setBusy(false);
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
      {w.status !== "VOID" ? (
        <Button variant="plain" onClick={() => openExtend(w.id)}>
          Extend
        </Button>
      ) : null}
      {w.status !== "VOID" ? (
        <Button tone="critical" variant="plain" onClick={() => openVoid(w.id)}>
          Void
        </Button>
      ) : null}
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
        {success ? (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccess(null)}>
              <p>{success}</p>
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
                <BlockStack gap="200">
                  <Text as="p" tone="subdued">
                    No warranties match this view yet.
                  </Text>
                  <Text as="p" tone="subdued">
                    Create a warranty rule under Products &amp; rules, then run a backfill or wait for
                    new Shopify orders (order webhooks require Protected Customer Data approval).
                  </Text>
                </BlockStack>
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

      <Modal
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title="Void warranty"
        primaryAction={{
          content: "Void warranty",
          onAction: confirmVoid,
          loading: busy,
          destructive: true,
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => setVoidOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" tone="subdued">
              Voiding permanently ends coverage. Customers will no longer see an active certificate.
            </Text>
            <TextField
              label="Reason"
              value={voidReason}
              onChange={setVoidReason}
              autoComplete="off"
              multiline={3}
              helpText="Shown in merchant history (not emailed to the customer)."
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        title="Extend warranty"
        primaryAction={{ content: "Extend", onAction: confirmExtend, loading: busy }}
        secondaryActions={[{ content: "Cancel", onAction: () => setExtendOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Extra months"
              type="number"
              value={extendMonths}
              onChange={setExtendMonths}
              autoComplete="off"
              min={1}
            />
            <TextField
              label="Reason"
              value={extendReason}
              onChange={setExtendReason}
              autoComplete="off"
              multiline={2}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
