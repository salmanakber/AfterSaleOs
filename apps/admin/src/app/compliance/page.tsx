"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PrivacyRow = {
  id: string;
  shopDomain: string;
  type: string;
  status: string;
  createdAt: string;
  dueAt: string | null;
};

export default function CompliancePage() {
  const router = useRouter();
  const [rows, setRows] = useState<PrivacyRow[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("aftersale_admin_token");
    if (!token) {
      router.replace("/");
      return;
    }
    fetch("/api/compliance", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => setRows(json.requests ?? []));
  }, [router]);

  return (
    <div className="shell">
      <div className="nav">
        <Link href="/dashboard">Overview</Link>
        <Link href="/shops">Shops</Link>
        <strong>Compliance</strong>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Privacy requests</h2>
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
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.shopDomain}</td>
                <td>{r.type}</td>
                <td>{r.status}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.dueAt ? new Date(r.dueAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
