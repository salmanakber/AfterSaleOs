"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/base-path";

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
      <div className="shell">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="nav">
        <Link href="/shops">← Shops</Link>
      </div>
      <h1>{shop.shopDomain}</h1>
      <p className="muted">{shop.shopName}</p>
      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="muted">Status</div>
          <strong>{shop.status}</strong>
        </div>
        <div className="card">
          <div className="muted">Billing</div>
          <strong>{shop.billingStatus}</strong>
        </div>
        <div className="card">
          <div className="muted">Plan</div>
          <strong>{shop.planName ?? "—"}</strong>
        </div>
        <div className="card">
          <div className="muted">Webhook failures</div>
          <strong>{shop.webhookFailures}</strong>
        </div>
        <div className="card">
          <div className="muted">Open privacy</div>
          <strong>{shop.privacyOpen}</strong>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Usage</h3>
        <ul>
          {shop.usage.map((u) => (
            <li key={`${u.metric}-${u.periodKey}`}>
              {u.metric}: {u.count} ({u.periodKey})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
