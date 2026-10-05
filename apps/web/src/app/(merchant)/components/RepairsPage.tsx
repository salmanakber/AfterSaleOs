"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  FormLayout,
  InlineStack,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { gqlRequest } from "@/lib/graphql";
import { useParams } from "next/navigation";
import { appHref } from "@/lib/shop-context";
import { PageEmpty, PageLoading } from "./PageLoading";
import { BrandLoader } from "./BrandLoader";

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
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    gqlRequest<{ repairs: Repair[] }>(LIST, { status: status || null })
      .then((d) => {
        setRows(d.repairs);
        setHasLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const byStatus = STATUSES.filter((s) => s !== "CANCELLED").map((s) => ({
    status: s,
    items: rows.filter((r) => r.status === s),
  }));

  return (
    <Page title="Repairs" subtitle={hasLoaded ? `${rows.length} on the board` : "Loading…"}>
      <div className="as-m-ops-surface">
        {error ? (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        ) : null}

        <div className="as-m-ops-banner">
          <div>
            <p className="as-m-ops-kicker">Operations</p>
            <h2>Repair board</h2>
            <p>Move repairs across stages from intake to ship-back.</p>
          </div>
          <div className="as-m-ops-toolbar">
            <div style={{ minWidth: 200 }}>
              <Select
                label="Filter status"
                labelHidden
                options={[
                  { label: "All statuses", value: "" },
                  ...STATUSES.map((s) => ({ label: s.replaceAll("_", " "), value: s })),
                ]}
                value={status}
                onChange={setStatus}
                disabled={loading && !hasLoaded}
              />
            </div>
            <Button onClick={load} loading={loading && hasLoaded} disabled={loading && !hasLoaded}>
              Refresh
            </Button>
          </div>
        </div>

        {loading && !hasLoaded ? (
          <PageLoading label="Loading repairs" />
        ) : rows.length === 0 ? (
          <PageEmpty
            title="No repairs yet"
            body="Create a repair from a claim’s Resolve tab to populate this board."
            action={<Button url={appHref("/claims")}>Open claims</Button>}
          />
        ) : (
          <div className={`as-m-board${loading ? " as-m-list-refreshing" : ""}`}>
            {byStatus.map((col) => (
              <div key={col.status} className="as-m-board-col">
                <h4>
                  {col.status.replaceAll("_", " ")} · {col.items.length}
                </h4>
                {col.items.length === 0 ? (
                  <Text as="p" tone="subdued" variant="bodySm">
                    Empty
                  </Text>
                ) : (
                  col.items.map((r) => (
                    <a key={r.id} className="as-m-board-item" href={appHref(`/repairs/${r.id}`)}>
                      <strong>{r.repairNumber}</strong>
                      <span>{r.claimNumber ?? "Claim"}</span>
                    </a>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </div>
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
    gqlRequest<{
      repair: Repair | null;
      staffMembers: typeof staff;
    }>(DETAIL, { id })
      .then((d) => {
        if (!d.repair) throw new Error("Repair not found");
        setRepair(d.repair);
        setStatus(d.repair.status);
        setDiagnosis(d.repair.diagnosis ?? "");
        setNotes(d.repair.notes ?? "");
        setCost(
          d.repair.repairCostCents != null ? (d.repair.repairCostCents / 100).toFixed(2) : "",
        );
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
    setError(null);
    try {
      await gqlRequest(
        `#graphql
        mutation U($input: UpdateRepairInput!) {
          updateRepair(input: $input) { id }
        }`,
        {
          input: {
            id,
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
        <div className="as-m-page-loading">
          <BrandLoader label="Opening repair" compact />
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
      backAction={{ url: appHref("/repairs") }}
      subtitle={repair.claimNumber ?? undefined}
      secondaryActions={[{ content: "Open claim", url: appHref(`/claims/${repair.claimId}`) }]}
    >
      <div className="as-m-ops-surface">
        {error ? (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        ) : null}
        <div className="as-m-ops-card">
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
            <TextField label="Diagnosis" value={diagnosis} onChange={setDiagnosis} multiline={3} autoComplete="off" />
            <TextField label="Notes" value={notes} onChange={setNotes} multiline={3} autoComplete="off" />
            <TextField label="Repair cost" type="number" value={cost} onChange={setCost} prefix="$" autoComplete="off" />
            <InlineStack gap="300">
              <div style={{ flex: 1 }}>
                <TextField label="Shipping in" value={shippingIn} onChange={setShippingIn} autoComplete="off" />
              </div>
              <div style={{ flex: 1 }}>
                <TextField label="Shipping out" value={shippingOut} onChange={setShippingOut} autoComplete="off" />
              </div>
            </InlineStack>
            <Button variant="primary" loading={busy} onClick={save}>
              Save repair
            </Button>
          </FormLayout>
        </div>
      </div>
    </Page>
  );
}
