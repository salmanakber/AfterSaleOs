"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";
import { AdminShell, Panel, StatusPill } from "@/components/AdminShell";

type PrivacyRow = {
  id: string;
  shopDomain: string;
  type: string;
  status: string;
  createdAt: string;
  dueAt: string | null;
};

function privacyTone(status: string): "ok" | "warn" | "bad" | "info" | "neutral" {
  if (status === "COMPLETED") return "ok";
  if (status === "IN_PROGRESS") return "info";
  if (status === "RECEIVED") return "warn";
  if (status === "FAILED") return "bad";
  return "neutral";
}

export default function CompliancePage() {
  const router = useRouter();
  const [rows, setRows] = useState<PrivacyRow[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("aftersale_admin_token");
    if (!token) {
      router.replace("/");
      return;
    }
    fetch(adminApi("/api/compliance"), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => setRows(json.requests ?? []));
  }, [router]);

  return (
    <AdminShell title="Compliance" lede="Privacy webhooks and open redaction / data requests.">
      <Panel title="Privacy requests">
        <div className="sa-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Shop</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sa-empty">
                    No open privacy requests
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.shopDomain}</td>
                    <td>{r.type}</td>
                    <td>
                      <StatusPill tone={privacyTone(r.status)}>{r.status}</StatusPill>
                    </td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>{r.dueAt ? new Date(r.dueAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </AdminShell>
  );
}
