"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";
import { AdminShell, Panel, StatusPill } from "@/components/AdminShell";

type OpsData = {
  webhookEvents: {
    id: string;
    shopDomain: string;
    topic: string;
    status: string;
    attempts: number;
    lastError: string | null;
    createdAt: string;
  }[];
  jobFailures: {
    id: string;
    queue: string;
    error: string;
    shopId: string | null;
    createdAt: string;
  }[];
  jobs: {
    id: string;
    shopDomain: string | null;
    type: string;
    status: string;
    progress: number;
    errorSummary: string | null;
    createdAt: string;
  }[];
};

function jobTone(status: string): "ok" | "warn" | "bad" | "info" | "neutral" {
  if (status === "COMPLETED" || status === "SUCCESS") return "ok";
  if (status === "FAILED" || status === "DEAD") return "bad";
  if (status === "PENDING" || status === "RUNNING") return "info";
  return "neutral";
}

export default function OpsPage() {
  const router = useRouter();
  const [data, setData] = useState<OpsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("aftersale_admin_token");
    if (!token) {
      router.replace("/");
      return;
    }
    fetch(adminApi("/api/ops"), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [router]);

  if (error) {
    return (
      <AdminShell title="Ops" lede="Jobs, queues, and webhook delivery.">
        <div className="sa-alert sa-alert-bad">{error}</div>
      </AdminShell>
    );
  }

  if (!data) {
    return (
      <AdminShell title="Ops" lede="Jobs, queues, and webhook delivery.">
        <p className="sa-muted">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Ops" lede="Jobs, queues, and webhook delivery health.">
      <Panel title="Recent jobs">
        <div className="sa-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Shop</th>
                <th>Type</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Error</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sa-empty">
                    No recent jobs
                  </td>
                </tr>
              ) : (
                data.jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.shopDomain ?? "—"}</td>
                    <td>{j.type}</td>
                    <td>
                      <StatusPill tone={jobTone(j.status)}>{j.status}</StatusPill>
                    </td>
                    <td>{j.progress}</td>
                    <td>{j.errorSummary ?? "—"}</td>
                    <td>{new Date(j.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Webhook failures / pending">
        <div className="sa-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Shop</th>
                <th>Topic</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Error</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.webhookEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sa-empty">
                    Queue looks clean
                  </td>
                </tr>
              ) : (
                data.webhookEvents.map((w) => (
                  <tr key={w.id}>
                    <td>{w.shopDomain}</td>
                    <td>{w.topic}</td>
                    <td>
                      <StatusPill tone={jobTone(w.status)}>{w.status}</StatusPill>
                    </td>
                    <td>{w.attempts}</td>
                    <td>{w.lastError ?? "—"}</td>
                    <td>{new Date(w.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Job failures">
        <div className="sa-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Queue</th>
                <th>Error</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.jobFailures.length === 0 ? (
                <tr>
                  <td colSpan={3} className="sa-empty">
                    No failures logged
                  </td>
                </tr>
              ) : (
                data.jobFailures.map((f) => (
                  <tr key={f.id}>
                    <td>{f.queue}</td>
                    <td>{f.error}</td>
                    <td>{new Date(f.createdAt).toLocaleString()}</td>
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
