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

const FEATURE_FIELDS: { key: keyof PlanRow; label: string; blurb: string }[] = [
  { key: "customBranding", label: "Custom branding", blurb: "Logo, colors, fonts on customer pages" },
  { key: "pdfCertificate", label: "PDF certificates", blurb: "Downloadable warranty PDFs" },
  { key: "qrCodes", label: "QR codes", blurb: "Printable QR studio & scan landings" },
  { key: "csvExport", label: "CSV export", blurb: "Export warranties and claims" },
  { key: "backfillBeyond12Months", label: "Deep history backfill", blurb: "Import beyond 12 months" },
  { key: "repairsEnabled", label: "Repairs", blurb: "Repair jobs and shipping" },
  { key: "customWorkflows", label: "Custom workflows", blurb: "Rename statuses & pipelines" },
  { key: "advancedAnalytics", label: "Advanced analytics", blurb: "Deeper claim insights" },
  { key: "bulkOperations", label: "Bulk operations", blurb: "Act on many records at once" },
  { key: "supplierPortal", label: "Supplier portal", blurb: "Route claims to suppliers" },
  { key: "technicianPortal", label: "Technician portal", blurb: "Focused repair queue" },
  { key: "publicApiEnabled", label: "Public API", blurb: "Programmatic integrations" },
  { key: "flowEnabled", label: "Shopify Flow", blurb: "Trigger Flow from events" },
  { key: "expiryCampaigns", label: "Expiry campaigns", blurb: "Remind before coverage ends" },
  { key: "partsInventory", label: "Parts inventory", blurb: "Spare parts for repairs" },
  { key: "multiLocation", label: "Multi-location", blurb: "Multiple store locations" },
  { key: "erpConnectors", label: "ERP connectors", blurb: "Sync resolutions to ERP" },
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

  function setAllFeatures(id: string, enabled: boolean) {
    const patch: Partial<PlanRow> = {};
    for (const f of FEATURE_FIELDS) {
      (patch as Record<string, boolean>)[f.key as string] = enabled;
    }
    updateDraft(id, patch);
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
      title="Plans & feature scope"
      lede="Set quotas and include/exclude every feature per plan. Merchant apps and the Plans page reflect these flags immediately after save."
    >
      {message ? <p className="sa-flash sa-flash-ok">{message}</p> : null}
      {error ? <p className="sa-flash sa-flash-bad">{error}</p> : null}

      <div className="sa-stack" style={{ display: "grid", gap: 16 }}>
        {plans.map((plan) => {
          const draft = drafts[plan.id] ?? plan;
          const included = FEATURE_FIELDS.filter((f) => Boolean(draft[f.key]));
          const excluded = FEATURE_FIELDS.filter((f) => !draft[f.key]);
          return (
            <Panel
              key={plan.id}
              title={`${draft.name} (${draft.slug})`}
              toolbar={
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <StatusPill tone={draft.isFree ? "info" : "ok"}>
                    {draft.isFree ? "Free" : `$${(draft.priceMonthlyCents / 100).toFixed(0)}/mo`}
                  </StatusPill>
                  <button
                    type="button"
                    className="sa-btn sa-btn-ghost"
                    onClick={() => setAllFeatures(plan.id, true)}
                  >
                    Include all
                  </button>
                  <button
                    type="button"
                    className="sa-btn sa-btn-ghost"
                    onClick={() => setAllFeatures(plan.id, false)}
                  >
                    Exclude all
                  </button>
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
              <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.75 }}>
                Included: {included.length} · Not included: {excluded.length}
              </p>

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
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                {FEATURE_FIELDS.map((f) => {
                  const on = Boolean(draft[f.key]);
                  return (
                    <label
                      key={f.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: "6px 10px",
                        alignItems: "start",
                        fontSize: 13,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: `1px solid ${on ? "rgba(16,185,129,0.35)" : "rgba(148,163,184,0.25)"}`,
                        background: on ? "rgba(16,185,129,0.08)" : "rgba(148,163,184,0.06)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          updateDraft(plan.id, {
                            [f.key]: e.target.checked,
                          } as Partial<PlanRow>)
                        }
                        style={{ marginTop: 3 }}
                      />
                      <span>
                        <strong style={{ display: "block" }}>
                          {f.label}{" "}
                          <span style={{ fontWeight: 500, opacity: 0.7 }}>
                            {on ? "· included" : "· not included"}
                          </span>
                        </strong>
                        <span style={{ display: "block", marginTop: 2, opacity: 0.7, fontSize: 12 }}>
                          {f.blurb}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>
    </AdminShell>
  );
}
