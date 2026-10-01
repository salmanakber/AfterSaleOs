"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";

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
      <div className="shell">
        <p style={{ color: "#f87171" }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="shell">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="nav">
        <Link href="/dashboard">Overview</Link>
        <Link href="/shops">Shops</Link>
        <strong>Jobs &amp; Webhooks</strong>
        <Link href="/compliance">Compliance</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Recent jobs</h2>
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
            {data.jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.shopDomain ?? "—"}</td>
                <td>{j.type}</td>
                <td>{j.status}</td>
                <td>{j.progress}</td>
                <td>{j.errorSummary ?? "—"}</td>
                <td>{new Date(j.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Webhook failures / pending</h2>
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
            {data.webhookEvents.map((w) => (
              <tr key={w.id}>
                <td>{w.shopDomain}</td>
                <td>{w.topic}</td>
                <td>{w.status}</td>
                <td>{w.attempts}</td>
                <td>{w.lastError ?? "—"}</td>
                <td>{new Date(w.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Job failures</h2>
        <table>
          <thead>
            <tr>
              <th>Queue</th>
              <th>Error</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.jobFailures.map((f) => (
              <tr key={f.id}>
                <td>{f.queue}</td>
                <td>{f.error}</td>
                <td>{new Date(f.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
