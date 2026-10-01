"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function PortalInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const token = params.get("token");

  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [warranties, setWarranties] = useState<
    | Array<{
        id: string;
        status: string;
        productTitle: string;
        orderNumber: string;
        serialNumber: string | null;
        certificateToken: string;
        startAt: string | null;
        endAt: string | null;
        ruleName: string;
      }>
    | null
  >(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/public/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Invalid link");
        if (!cancelled) setWarranties(json.warranties ?? []);
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : "Could not open portal");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function requestLink(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/guest-link?shop=${encodeURIComponent(shop)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orderNumber, shop }),
      });
      const json = await res.json();
      setMessage(json.message ?? "If we find a matching order, you will receive an email shortly.");
    } finally {
      setLoading(false);
    }
  }

  function badgeClass(status: string) {
    if (status === "ACTIVE") return "as-badge as-badge-active";
    if (status === "EXPIRING_SOON") return "as-badge as-badge-expiring";
    if (status === "EXPIRED") return "as-badge as-badge-expired";
    if (status === "VOID") return "as-badge as-badge-void";
    return "as-badge as-badge-pending";
  }

  return (
    <div className="as-shell">
      <div className="as-brand">AfterSale</div>
      <p className="as-muted">Your warranties</p>

      {warranties ? (
        <div className="as-stack">
          {warranties.length === 0 ? (
            <div className="as-card">
              <p className="as-muted">No warranties found for this order.</p>
            </div>
          ) : (
            warranties.map((w) => (
              <div className="as-card" key={w.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{w.productTitle}</strong>
                  <span className={badgeClass(w.status)}>{w.status.replaceAll("_", " ")}</span>
                </div>
                <p className="as-muted" style={{ margin: "8px 0" }}>
                  Order {w.orderNumber}
                  {w.serialNumber ? ` · Serial ${w.serialNumber}` : ""} · {w.ruleName}
                </p>
                <p className="as-muted" style={{ margin: "0 0 12px" }}>
                  {w.startAt ? new Date(w.startAt).toLocaleDateString() : "Pending start"}
                  {" → "}
                  {w.endAt ? new Date(w.endAt).toLocaleDateString() : "Lifetime"}
                </p>
                <a className="as-link" href={`/c/${w.certificateToken}`}>
                  View certificate
                </a>
              </div>
            ))
          )}
        </div>
      ) : (
        <form className="as-card" onSubmit={requestLink}>
          <p className="as-muted">
            Enter the email and order number from your purchase. We will email a one-time link.
          </p>
          <label className="as-label">Email</label>
          <input className="as-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="as-label">Order number</label>
          <input
            className="as-input"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="#1001"
          />
          {message ? <p className="as-muted">{message}</p> : null}
          {loading ? <p className="as-muted">Working…</p> : null}
          <button className="as-btn" disabled={loading || !shop} type="submit">
            {loading ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="as-shell">Loading…</div>}>
      <PortalInner />
    </Suspense>
  );
}
