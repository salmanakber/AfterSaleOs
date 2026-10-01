"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Overview = {
  shops: { total: number; active: number; uninstalled: number };
  jobs: { failed: number; pendingWebhooks: number };
  privacy: { open: number };
  recentShops: {
    id: string;
    shopDomain: string;
    status: string;
    planName: string | null;
    installedAt: string;
  }[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("aftersale_admin_token");
    if (!token) {
      router.replace("/");
      return;
    }
    fetch("/api/overview", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/");
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.error) setError(json.error);
        else if (json) setData(json);
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
        <strong>Super Admin</strong>
        <Link href="/dashboard">Overview</Link>
        <Link href="/shops">Shops</Link>
        <Link href="/compliance">Compliance</Link>
        <button
          className="btn"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            localStorage.removeItem("aftersale_admin_token");
            router.push("/");
          }}
        >
          Sign out
        </button>
      </div>

      <div className="grid">
        <div className="card">
          <div className="muted">Active shops</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{data.shops.active}</div>
        </div>
        <div className="card">
          <div className="muted">Total installs</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{data.shops.total}</div>
        </div>
        <div className="card">
          <div className="muted">Failed jobs</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{data.jobs.failed}</div>
        </div>
        <div className="card">
          <div className="muted">Pending webhooks</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{data.jobs.pendingWebhooks}</div>
        </div>
        <div className="card">
          <div className="muted">Open privacy requests</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{data.privacy.open}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Recent shops</h2>
        <table>
          <thead>
            <tr>
              <th>Domain</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Installed</th>
            </tr>
          </thead>
          <tbody>
            {data.recentShops.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/shops/${s.id}`}>{s.shopDomain}</Link>
                </td>
                <td>{s.status}</td>
                <td>{s.planName ?? "—"}</td>
                <td>{new Date(s.installedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
