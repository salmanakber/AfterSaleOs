"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CustomerShell } from "../../../components/CustomerShell";

function PortalInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const token = params.get("token");
  const embed = params.get("embed") === "1";

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
    <CustomerShell
      title="Your warranties"
      lede="Certificates, coverage dates, and claim entry in one calm place."
      shopDomain={shop}
      embed={embed}
      steps={warranties ? ["Verify", "Open portal", "Manage"] : ["Verify", "Email link", "Open portal"]}
      activeStep={warranties ? 2 : 0}
      footer={
        <a className="as-link" href={`/apps/aftersale/register?shop=${encodeURIComponent(shop)}`}>
          Register another product →
        </a>
      }
    >
      {warranties ? (
        <div className="as-stack">
          {warranties.length === 0 ? (
            <div className="as-empty">
              <strong>No warranties yet</strong>
              <p className="as-muted">This order doesn’t have active coverage on file.</p>
            </div>
          ) : (
            warranties.map((w) => (
              <article className="as-card" key={w.id}>
                <div className="as-warranty-row">
                  <h2 className="as-warranty-title">{w.productTitle}</h2>
                  <span className={badgeClass(w.status)}>{w.status.replaceAll("_", " ")}</span>
                </div>
                <div className="as-meta">
                  <span>
                    Order <strong>{w.orderNumber}</strong>
                  </span>
                  {w.serialNumber ? (
                    <span>
                      Serial <strong>{w.serialNumber}</strong>
                    </span>
                  ) : null}
                  <span>{w.ruleName}</span>
                </div>
                <div className="as-meta">
                  <span>
                    {w.startAt ? new Date(w.startAt).toLocaleDateString() : "Pending start"}
                    {" → "}
                    {w.endAt ? new Date(w.endAt).toLocaleDateString() : "Lifetime"}
                  </span>
                </div>
                <div className="as-actions" style={{ marginTop: 8 }}>
                  <a className="as-btn as-btn-secondary" href={`/c/${w.certificateToken}`}>
                    View certificate
                  </a>
                  <a
                    className="as-btn as-btn-ghost"
                    href={`/apps/aftersale/claim?shop=${encodeURIComponent(shop)}&certificate=${encodeURIComponent(w.certificateToken)}`}
                  >
                    Start a claim
                  </a>
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        <form onSubmit={requestLink}>
          <p className="as-muted" style={{ marginTop: 0 }}>
            Enter the email and order number from your purchase. We’ll send a one-time secure link —
            no password needed.
          </p>
          <label className="as-label">Email</label>
          <input
            className="as-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <label className="as-label">Order number</label>
          <input
            className="as-input"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="#1001"
          />
          {message ? <div className="as-alert as-alert-ok">{message}</div> : null}
          <button className="as-btn" disabled={loading || !shop} type="submit">
            {loading ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}
    </CustomerShell>
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="as-shell">Loading portal…</div>}>
      <PortalInner />
    </Suspense>
  );
}
