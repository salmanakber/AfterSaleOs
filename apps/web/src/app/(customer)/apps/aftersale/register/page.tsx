"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function RegisterInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const productTitle = params.get("product") ?? "";
  const productId = params.get("product_id") ?? "";
  const variantId = params.get("variant_id") ?? "";
  const qr = params.get("qr") ?? "";

  const [mode, setMode] = useState<"shopify" | "outside">("shopify");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serial, setSerial] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [cert, setCert] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => params.toString(), [params]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/register?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          serialNumber: serial || undefined,
          orderNumber: orderNumber || undefined,
          purchaseDate: purchaseDate || undefined,
          sellerName: sellerName || undefined,
          productTitle: productTitle || undefined,
          shopifyProductId: productId || undefined,
          shopifyVariantId: variantId || undefined,
          outsideShopify: mode === "outside",
          source: qr ? "qr" : "form",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Registration failed");
      setMessage(json.message);
      setCert(json.certificateToken ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="as-shell">
      <div className="as-brand">AfterSale</div>
      <p className="as-muted">Register your product for warranty coverage</p>
      {productTitle ? (
        <p>
          <strong>{productTitle}</strong>
        </p>
      ) : null}

      <div className="as-tabs as-no-print">
        <button type="button" className="as-tab" data-active={mode === "shopify"} onClick={() => setMode("shopify")}>
          Bought here
        </button>
        <button type="button" className="as-tab" data-active={mode === "outside"} onClick={() => setMode("outside")}>
          Bought elsewhere
        </button>
      </div>

      <form className="as-card" onSubmit={onSubmit}>
        <label className="as-label">Email</label>
        <input className="as-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="as-label">First name</label>
        <input className="as-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <label className="as-label">Last name</label>
        <input className="as-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <label className="as-label">Serial number</label>
        <input className="as-input" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="If required" />

        {mode === "shopify" ? (
          <>
            <label className="as-label">Order number</label>
            <input className="as-input" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="#1001" />
          </>
        ) : (
          <>
            <label className="as-label">Purchase date</label>
            <input className="as-input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            <label className="as-label">Seller / store name</label>
            <input className="as-input" value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
            <p className="as-muted">Purchases outside Shopify need merchant verification.</p>
          </>
        )}

        {error ? <p style={{ color: "var(--as-status-rejected)" }}>{error}</p> : null}
        {message ? <p style={{ color: "var(--as-status-active)" }}>{message}</p> : null}
        {cert ? (
          <p>
            <a className="as-link" href={`/c/${cert}`}>
              View your warranty certificate
            </a>
          </p>
        ) : null}

        <button className="as-btn" type="submit" disabled={loading || !shop}>
          {loading ? "Submitting…" : "Register product"}
        </button>
      </form>

      <p className="as-muted" style={{ marginTop: 16 }}>
        <a className="as-link" href={`/apps/aftersale/portal?shop=${encodeURIComponent(shop)}`}>
          View your warranties
        </a>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="as-shell">Loading…</div>}>
      <RegisterInner />
    </Suspense>
  );
}
