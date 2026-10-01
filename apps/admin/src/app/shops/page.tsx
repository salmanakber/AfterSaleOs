"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";
import { AdminShell, Panel, StatusPill } from "@/components/AdminShell";

type ShopRow = {
  id: string;
  shopDomain: string;
  status: string;
  billingStatus: string;
  planName: string | null;
  installedAt: string;
};

function statusTone(status: string): "ok" | "warn" | "bad" | "neutral" {
  if (status === "ACTIVE") return "ok";
  if (status === "SUSPENDED") return "warn";
  if (status === "UNINSTALLED") return "bad";
  return "neutral";
}

export default function ShopsPage() {
  const router = useRouter();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("aftersale_admin_token");
    if (!token) {
      router.replace("/");
      return;
    }
    const url = q ? adminApi(`/api/shops?q=${encodeURIComponent(q)}`) : adminApi("/api/shops");
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => setShops(json.shops ?? []));
  }, [router, q]);

  return (
    <AdminShell title="Shops" lede="Search installs, billing state, and plan assignment.">
      <Panel
        toolbar={
          <input
            className="sa-input"
            placeholder="Search domain…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 280 }}
          />
        }
      >
        <div className="sa-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Status</th>
                <th>Billing</th>
                <th>Plan</th>
                <th>Installed</th>
              </tr>
            </thead>
            <tbody>
              {shops.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sa-empty">
                    No shops match
                  </td>
                </tr>
              ) : (
                shops.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/shops/${s.id}`}>{s.shopDomain}</Link>
                    </td>
                    <td>
                      <StatusPill tone={statusTone(s.status)}>{s.status}</StatusPill>
                    </td>
                    <td>{s.billingStatus}</td>
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
