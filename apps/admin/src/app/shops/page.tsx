"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ShopRow = {
  id: string;
  shopDomain: string;
  status: string;
  billingStatus: string;
  planName: string | null;
  installedAt: string;
};

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
    const url = q ? `/api/shops?q=${encodeURIComponent(q)}` : "/api/shops";
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => setShops(json.shops ?? []));
  }, [router, q]);

  return (
    <div className="shell">
      <div className="nav">
        <Link href="/dashboard">Overview</Link>
        <strong>Shops</strong>
        <Link href="/compliance">Compliance</Link>
      </div>
      <input
        className="input"
        placeholder="Search domain…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 360 }}
      />
      <div className="card">
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
            {shops.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/shops/${s.id}`}>{s.shopDomain}</Link>
                </td>
                <td>{s.status}</td>
                <td>{s.billingStatus}</td>
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
