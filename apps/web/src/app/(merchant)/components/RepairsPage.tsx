"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { useParams } from "next/navigation";

type Repair = {
  id: string;
  repairNumber: string;
  claimId: string;
  claimNumber: string | null;
  status: string;
  diagnosis: string | null;
  notes: string | null;
  repairCostCents: number | null;
  currency: string;
  shippingIn: string | null;
  shippingOut: string | null;
  technician: { id: string; name: string | null; email: string } | null;
  completedAt: string | null;
  updatedAt: string;
};

const STATUSES = [
  "REPAIR_REQUIRED",
  "PRODUCT_RECEIVED",
  "DIAGNOSIS",
  "REPAIRING",
  "QUALITY_CHECK",
  "READY",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
];

const LIST = `#graphql
  query Repairs($status: String) {
    repairs(status: $status, limit: 100) {
      id repairNumber claimId claimNumber status diagnosis notes
      repairCostCents currency shippingIn shippingOut
      technician { id name email }
      completedAt updatedAt
    }
  }
`;

const DETAIL = `#graphql
  query Repair($id: ID!) {
    repair(id: $id) {
      id repairNumber claimId claimNumber status diagnosis notes
      repairCostCents currency shippingIn shippingOut
      technician { id name email }
      completedAt updatedAt
    }
    staffMembers { id name email active }
  }
`;

export function RepairsListPage() {
  const [rows, setRows] = useState<Repair[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    gqlRequest<{ repairs: Repair[] }>(LIST, { status: status || null })
      .then((d) => setRows(d.repairs))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const byStatus = STATUSES.filter((s) => s !== "CANCELLED").map((s) => ({
    status: s,
    items: rows.filter((r) => r.status === s),
  }));

  return (
    <Page title="Repairs" subtitle={`${rows.length} open board`}>
      <Layout>
        {error ? (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        ) : null}
        <Layout.Section>
          <InlineStack gap="300" blockAlign="end">
            <div style={{ minWidth: 220 }}>
              <Select
                label="Filter status"
                options={[
                  { label: "All", value: "" },
                  ...STATUSES.map((s) => ({ label: s.replaceAll("_", " "), value: s })),
                ]}
                value={status}
                onChange={setStatus}
              />
            </div>
            <Button onClick={load}>Refresh</Button>
          </InlineStack>
        </Layout.Section>
        <Layout.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {byStatus.map((col) => (
              <Card key={col.status}>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    {col.status.replaceAll("_", " ")} ({col.items.length})
                  </Text>
                  {col.items.length === 0 ? (
                    <Text as="p" tone="subdued">
                      —
                    </Text>
                  ) : (
                    col.items.map((r) => (
                      <BlockStack gap="050" key={r.id}>
                        <Button url={`/repairs/${r.id}`} variant="plain">
                          {r.repairNumber}
                        </Button>
                        <Text as="p" tone="subdued" variant="bodySm">
                          {r.claimNumber ?? r.claimId}
                        </Text>
                      </BlockStack>
                    ))
                  )}
                </BlockStack>
              </Card>
            ))}
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function RepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [repair, setRepair] = useState<Repair | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string | null; email: string; active?: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [shippingIn, setShippingIn] = useState("");
  const [shippingOut, setShippingOut] = useState("");
  const [technicianId, setTechnicianId] = useState("");

  const load = useCallback(() => {
    gqlRequest<{ repair: Repair | null; staffMembers: typeof staff }>(DETAIL, { id })
      .then((d) => {
        if (!d.repair) throw new Error("Repair not found");
        setRepair(d.repair);
        setStatus(d.repair.status);
        setDiagnosis(d.repair.diagnosis ?? "");
        setNotes(d.repair.notes ?? "");
        setCost(d.repair.repairCostCents != null ? String(d.repair.repairCostCents / 100) : "");
        setShippingIn(d.repair.shippingIn ?? "");
        setShippingOut(d.repair.shippingOut ?? "");
        setTechnicianId(d.repair.technician?.id ?? "");
        setStaff(d.staffMembers);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setBusy(true);
    try {
      await gqlRequest(
        `#graphql
        mutation U($id: ID!, $input: UpdateRepairInput!) {
          updateRepair(id: $id, input: $input) { id status }
        }`,
        {
          id,
          input: {
            status,
            diagnosis: diagnosis || null,
            notes: notes || null,
            repairCostCents: cost ? Math.round(parseFloat(cost) * 100) : null,
            shippingIn: shippingIn || null,
            shippingOut: shippingOut || null,
            technicianId: technicianId || null,
          },
        },
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!repair && !error) {
    return (
      <Page title="Repair">
        <div style={{ padding: "32px 0" }}>
          <div className="as-loader as-loader--compact" role="status">
            <div className="as-loader-mark" aria-hidden>
              <span className="as-loader-ring" />
              <span className="as-loader-ring as-loader-ring-b" />
              <span className="as-loader-core">A</span>
            </div>
            <p className="as-loader-label">Loading repairs</p>
            <div className="as-loader-bar" aria-hidden>
              <span />
            </div>
          </div>
        </div>
      </Page>
    );
  }
  if (!repair) {
    return (
      <Page title="Repair">
        <Banner tone="critical">{error}</Banner>
      </Page>
    );
  }

  return (
    <Page
      title={repair.repairNumber}
      backAction={{ url: "/repairs" }}
      titleMetadata={<Badge>{repair.status.replaceAll("_", " ")}</Badge>}
      secondaryActions={[{ content: "Open claim", url: `/claims/${repair.claimId}` }]}
    >
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
            <FormLayout>
              <Select
                label="Status"
                options={STATUSES.map((s) => ({ label: s.replaceAll("_", " "), value: s }))}
                value={status}
                onChange={setStatus}
              />
              <Select
                label="Technician"
                options={[
                  { label: "Unassigned", value: "" },
                  ...staff
                    .filter((s) => s.active !== false)
                    .map((s) => ({
                    label: s.name ? `${s.name} (${s.email})` : s.email,
                    value: s.id,
                  })),
                ]}
                value={technicianId}
                onChange={setTechnicianId}
              />
              <TextField
                label="Diagnosis"
                value={diagnosis}
                onChange={setDiagnosis}
                multiline={3}
                autoComplete="off"
              />
              <TextField label="Notes" value={notes} onChange={setNotes} multiline={3} autoComplete="off" />
              <TextField
                label="Repair cost"
                type="number"
                value={cost}
                onChange={setCost}
                prefix="$"
                autoComplete="off"
              />
              <TextField
                label="Shipping in"
                value={shippingIn}
                onChange={setShippingIn}
                autoComplete="off"
              />
              <TextField
                label="Shipping out"
                value={shippingOut}
                onChange={setShippingOut}
                autoComplete="off"
              />
              <Button variant="primary" loading={busy} onClick={save}>
                Save repair
              </Button>
            </FormLayout>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
