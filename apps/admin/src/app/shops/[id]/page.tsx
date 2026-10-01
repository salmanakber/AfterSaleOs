"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";
import { AdminShell, Panel, StatCard, StatusPill } from "@/components/AdminShell";

type ShopDetail = {
  id: string;
  shopDomain: string;
  shopName: string | null;
  status: string;
  billingStatus: string;
  planName: string | null;
  installedAt: string;
  usage: { metric: string; count: number; periodKey: string }[];
  webhookFailures: number;
  privacyOpen: number;
};

function statusTone(status: string): "ok" | "warn" | "bad" | "neutral" {
  if (status === "ACTIVE") return "ok";
  if (status === "SUSPENDED") return "warn";
  if (status === "UNINSTALLED") return "bad";
  return "neutral";
}

function statTone(status: string): "ok" | "warn" | "bad" | undefined {
  const t = statusTone(status);
  return t === "neutral" ? undefined : t;
}

export default function ShopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [shop, setShop] = useState<ShopDetail | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("aftersale_admin_token");
    if (!token) {
      router.replace("/");
      return;
    }
    fetch(adminApi(`/api/shops/${id}`), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => setShop(json.shop ?? null));
  }, [id, router]);

  if (!shop) {
    return (
      <AdminShell title="Shop" lede="Loading merchant detail…">
        <p className="sa-muted">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={shop.shopDomain}
      lede={shop.shopName ?? "Merchant workspace detail"}
      actions={
        <Link className="sa-btn sa-btn-ghost" href="/shops">
          ← All shops
        </Link>
      }
    >
      <div className="sa-grid">
        <StatCard label="Status" value={shop.status} tone={statTone(shop.status)} />
        <StatCard label="Billing" value={shop.billingStatus} />
        <StatCard label="Plan" value={shop.planName ?? "—"} />
        <StatCard
          label="Webhook failures"
          value={shop.webhookFailures}
          tone={shop.webhookFailures ? "bad" : "ok"}
        />
        <StatCard
          label="Open privacy"
          value={shop.privacyOpen}
          tone={shop.privacyOpen ? "warn" : "ok"}
        />
      </div>

      <Panel title="Usage meters">
        {shop.usage.length === 0 ? (
          <p className="sa-muted">No usage rows yet.</p>
        ) : (
          <div className="sa-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Count</th>
                  <th>Period</th>
                </tr>
              </thead>
              <tbody>
                {shop.usage.map((u) => (
                  <tr key={`${u.metric}-${u.periodKey}`}>
                    <td>{u.metric}</td>
                    <td>{u.count}</td>
                    <td>{u.periodKey}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Install">
        <p className="sa-muted" style={{ margin: 0 }}>
          Installed {new Date(shop.installedAt).toLocaleString()} ·{" "}
          <StatusPill tone={statusTone(shop.status)}>{shop.status}</StatusPill>
        </p>
      </Panel>
    </AdminShell>
  );
}
