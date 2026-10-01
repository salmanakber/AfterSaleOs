"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";
import { AdminShell, Panel, StatCard, StatusPill } from "@/components/AdminShell";

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

function statusTone(status: string): "ok" | "warn" | "bad" | "neutral" {
  if (status === "ACTIVE") return "ok";
  if (status === "SUSPENDED") return "warn";
  if (status === "UNINSTALLED") return "bad";
  return "neutral";
}

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
    fetch(adminApi("/api/overview"), { headers: { Authorization: `Bearer ${token}` } })
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
      <AdminShell title="Overview" lede="Platform health at a glance.">
        <div className="sa-alert sa-alert-bad">{error}</div>
      </AdminShell>
    );
  }

  if (!data) {
    return (
      <AdminShell title="Overview" lede="Platform health at a glance.">
        <p className="sa-muted">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Overview"
      lede="Shops, jobs, and privacy pressure across the platform."
      actions={
        <Link className="sa-btn sa-btn-ghost" href="/shops">
          Browse shops
        </Link>
      }
    >
      <div className="sa-grid">
        <StatCard label="Active shops" value={data.shops.active} tone="ok" hint={`${data.shops.total} total`} />
        <StatCard label="Uninstalled" value={data.shops.uninstalled} tone="warn" />
        <StatCard label="Failed jobs" value={data.jobs.failed} tone={data.jobs.failed ? "bad" : "ok"} />
        <StatCard
          label="Pending webhooks"
          value={data.jobs.pendingWebhooks}
          tone={data.jobs.pendingWebhooks ? "warn" : "info"}
        />
        <StatCard
          label="Open privacy"
          value={data.privacy.open}
          tone={data.privacy.open ? "warn" : "ok"}
        />
      </div>

      <Panel title="Recent shops">
        <div className="sa-table-wrap">
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
              {data.recentShops.length === 0 ? (
                <tr>
                  <td colSpan={4} className="sa-empty">
                    No shops yet
                  </td>
                </tr>
              ) : (
                data.recentShops.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/shops/${s.id}`}>{s.shopDomain}</Link>
                    </td>
                    <td>
                      <StatusPill tone={statusTone(s.status)}>{s.status}</StatusPill>
                    </td>
                    <td>{s.planName ?? "—"}</td>
                    <td>{new Date(s.installedAt).toLocaleDateString()}</td>
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
