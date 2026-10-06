"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";
import { AdminShell, Panel, StatusPill } from "@/components/AdminShell";

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  priceMonthlyCents: number;
  isFree: boolean;
  warrantiesPerMonth: number;
  claimsPerMonth: number;
  attachmentStorageMb: number;
  staffSeats: number;
  aiCreditsPerMonth: number;
  warrantyRulesLimit: number;
  locationsLimit: number;
  technicianAccounts: number;
  publicApiEnabled: boolean;
  customBranding: boolean;
  pdfCertificate: boolean;
  qrCodes: boolean;
  csvExport: boolean;
  backfillBeyond12Months: boolean;
  repairsEnabled: boolean;
  customWorkflows: boolean;
  advancedAnalytics: boolean;
  flowEnabled: boolean;
  expiryCampaigns: boolean;
  bulkOperations: boolean;
  supplierPortal: boolean;
  technicianPortal: boolean;
  partsInventory: boolean;
  multiLocation: boolean;
  erpConnectors: boolean;
  sortOrder: number;
};

const QUOTA_FIELDS: { key: keyof PlanRow; label: string }[] = [
  { key: "warrantiesPerMonth", label: "Warranties / mo" },
  { key: "claimsPerMonth", label: "Claims / mo" },
  { key: "aiCreditsPerMonth", label: "AI credits / mo" },
  { key: "staffSeats", label: "Staff seats" },
  { key: "warrantyRulesLimit", label: "Warranty rules" },
  { key: "attachmentStorageMb", label: "Storage (MB)" },
  { key: "locationsLimit", label: "Locations" },
  { key: "technicianAccounts", label: "Technicians" },
  { key: "priceMonthlyCents", label: "Price (cents)" },
];

const FEATURE_FIELDS: { key: keyof PlanRow; label: string }[] = [
  { key: "customBranding", label: "Custom branding" },
  { key: "pdfCertificate", label: "PDF certificates" },
  { key: "qrCodes", label: "QR codes" },
  { key: "csvExport", label: "CSV export" },
  { key: "backfillBeyond12Months", label: "Backfill > 12 months" },
  { key: "repairsEnabled", label: "Repairs" },
  { key: "customWorkflows", label: "Custom workflows" },
  { key: "advancedAnalytics", label: "Advanced analytics" },
  { key: "bulkOperations", label: "Bulk operations" },
  { key: "supplierPortal", label: "Supplier portal" },
  { key: "technicianPortal", label: "Technician portal" },
  { key: "publicApiEnabled", label: "Public API" },
  { key: "flowEnabled", label: "Shopify Flow" },
  { key: "expiryCampaigns", label: "Expiry campaigns" },
  { key: "partsInventory", label: "Parts inventory" },
  { key: "multiLocation", label: "Multi-location" },
  { key: "erpConnectors", label: "ERP connectors" },
];

export default function AdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PlanRow>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = () => localStorage.getItem("aftersale_admin_token");

  const load = useCallback(() => {
    const t = token();
    if (!t) {
      router.replace("/");
      return;
    }
    fetch(adminApi("/api/plans"), { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        const rows = (json.plans ?? []) as PlanRow[];
        setPlans(rows);
        const next: Record<string, PlanRow> = {};
        for (const p of rows) next[p.id] = { ...p };
        setDrafts(next);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load plans"));
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function updateDraft(id: string, patch: Partial<PlanRow>) {
    setDrafts((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }

  async function save(id: string) {
    const t = token();
    const draft = drafts[id];
    if (!t || !draft) return;
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(adminApi("/api/plans"), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setMessage(`Saved ${draft.name}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      title="Plans & limits"
      lede="Raise or lower quotas and feature flags. Merchant apps enforce these values immediately."
    >
      {message ? <p className="sa-flash sa-flash-ok">{message}</p> : null}
      {error ? <p className="sa-flash sa-flash-bad">{error}</p> : null}

      <div className="sa-stack" style={{ display: "grid", gap: 16 }}>
        {plans.map((plan) => {
          const draft = drafts[plan.id] ?? plan;
          return (
            <Panel
              key={plan.id}
              title={`${draft.name} (${draft.slug})`}
              toolbar={
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <StatusPill tone={draft.isFree ? "info" : "ok"}>
                    {draft.isFree ? "Free" : `$${(draft.priceMonthlyCents / 100).toFixed(0)}/mo`}
                  </StatusPill>
                  <button
                    type="button"
                    className="sa-btn"
                    disabled={busyId === plan.id}
                    onClick={() => void save(plan.id)}
                  >
                    {busyId === plan.id ? "Saving…" : "Save"}
                  </button>
                </div>
              }
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {QUOTA_FIELDS.map((f) => (
                  <label key={f.key} style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <span>{f.label}</span>
                    <input
                      className="sa-input"
                      type="number"
                      min={0}
                      value={Number(draft[f.key] ?? 0)}
                      onChange={(e) =>
                        updateDraft(plan.id, {
                          [f.key]: Number(e.target.value || 0),
                        } as Partial<PlanRow>)
                      }
                    />
                  </label>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 8,
                }}
              >
                {FEATURE_FIELDS.map((f) => (
                  <label
                    key={f.key}
                    style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(draft[f.key])}
                      onChange={(e) =>
                        updateDraft(plan.id, {
                          [f.key]: e.target.checked,
                        } as Partial<PlanRow>)
                      }
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </AdminShell>
  );
}
