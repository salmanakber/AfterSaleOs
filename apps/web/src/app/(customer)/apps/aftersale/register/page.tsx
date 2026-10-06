"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { customerPageUrl, publicApiUrl } from "@/lib/public-api";
import { BrandLoader } from "../../../components/BrandLoader";
import { CustomerShell } from "../../../components/CustomerShell";
import { OrderPicker } from "../../../components/OrderPicker";

function RegisterInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const productTitle = params.get("product") ?? "";
  const productId = params.get("product_id") ?? "";
  const variantId = params.get("variant_id") ?? "";
  const qr = params.get("qr") ?? "";
  const embed = params.get("embed") === "1";
  const themeLocal = params.get("theme") === "local" || embed;
  const accentOverride = params.get("accent");
  const auto = params.get("auto") === "1";
  const prefillEmail = params.get("email") ?? "";
  const prefillOrder = params.get("order") ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serial, setSerial] = useState("");
  const [orderNumber, setOrderNumber] = useState(prefillOrder);
  const [message, setMessage] = useState<string | null>(null);
  const [cert, setCert] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const query = useMemo(() => params.toString(), [params]);
  const done = Boolean(cert || message);
  const loggedInEmail = Boolean(prefillEmail);

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
    if (prefillOrder) setOrderNumber(prefillOrder);
  }, [prefillEmail, prefillOrder]);

  async function requestVerify(e: FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setVerifyMsg(null);
    setError(null);
    try {
      if (!shop) throw new Error("Missing shop.");
      const res = await fetch(publicApiUrl(`/api/public/guest-link?shop=${encodeURIComponent(shop)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orderNumber, shop }),
      });
      const json = await res.json();
      if (json.portal?.orders?.[0]) {
        setOrderNumber(json.portal.orders[0].orderNumber);
        setVerifyMsg(json.emailHint ?? "Verified — pick your order or continue.");
      } else {
        setVerifyMsg(json.message ?? "If we find a matching order, you will receive an email shortly.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!shop) throw new Error("Missing shop. Open this page from your store or embed link.");
      const res = await fetch(publicApiUrl(`/api/public/register?${query}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          serialNumber: serial || undefined,
          orderNumber: orderNumber || undefined,
          productTitle: productTitle || undefined,
          shopifyProductId: productId || undefined,
          shopifyVariantId: variantId || undefined,
          outsideShopify: false,
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

  if (done) {
    return (
      <CustomerShell
        title="You're covered"
        lede="Registration received. Your certificate is ready when coverage activates."
        shopDomain={shop}
        embed={embed}
        themeLocal={themeLocal}
        accentOverride={accentOverride}
        steps={["Details", "Submit", "Certificate"]}
        activeStep={2}
        footer={
          <a className="as-link" href={customerPageUrl("/apps/aftersale/portal", shop)}>
            Open warranty portal →
          </a>
        }
      >
        <div className="as-success-hero">
          <div className="as-success-icon" aria-hidden>
            ✓
          </div>
          {message ? <div className="as-alert as-alert-ok">{message}</div> : null}
          {cert ? (
            <div className="as-actions">
              <a className="as-btn" href={`/c/${cert}`}>
                View certificate
              </a>
            </div>
          ) : null}
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell
      title="Register your product"
      lede={
        productTitle
          ? `Activate coverage for ${productTitle}.`
          : "Choose your order and activate coverage."
      }
      shopDomain={shop}
      embed={embed}
      themeLocal={themeLocal}
      accentOverride={accentOverride}
      steps={["Details", "Submit", "Certificate"]}
      activeStep={0}
      footer={
        <a className="as-link" href={customerPageUrl("/apps/aftersale/portal", shop)}>
          Already registered? Open your portal →
        </a>
      }
    >
      {!shop ? (
        <div className="as-alert as-alert-error">
          This registration page needs a shop link. Open it from your store, QR code, or theme embed.
        </div>
      ) : null}
      {auto || loggedInEmail ? (
        <div className="as-alert as-alert-ok">
          {loggedInEmail
            ? "Signed in — pick the order that matches this product."
            : "Registering from your order — no extra email verification needed for this purchase."}
        </div>
      ) : null}

      {loggedInEmail && shop ? (
        <div style={{ marginBottom: 16 }}>
          <OrderPicker
            shop={shop}
            email={email}
            selectedOrderNumber={orderNumber}
            mode="order"
            onSelect={(o) => setOrderNumber(o.orderNumber)}
          />
        </div>
      ) : null}

      {!loggedInEmail ? (
        <form onSubmit={requestVerify} style={{ marginBottom: 18 }}>
          <p className="as-muted" style={{ marginTop: 0 }}>
            Not signed in? Verify with the email and order number from your purchase — we’ll open
            coverage when they match, and email a secure link when mail is configured.
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
          {verifyMsg ? <div className="as-alert as-alert-ok">{verifyMsg}</div> : null}
          <button className="as-btn as-btn-secondary" type="submit" disabled={verifying || !shop}>
            {verifying ? "Checking…" : "Verify my order"}
          </button>
        </form>
      ) : null}

      <form onSubmit={onSubmit}>
        {loggedInEmail ? (
          <>
            <label className="as-label">Email</label>
            <input className="as-input" type="email" required value={email} readOnly />
            <label className="as-label">Order number</label>
            <input
              className="as-input"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Select an order above or type #"
            />
          </>
        ) : null}

        <div className="as-field-grid">
          <div>
            <label className="as-label">First name</label>
            <input className="as-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="as-label">Last name</label>
            <input className="as-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <label className="as-label">Serial number</label>
        <input
          className="as-input"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="If your product requires one"
        />

        {error ? <div className="as-alert as-alert-error">{error}</div> : null}

        <button className="as-btn" type="submit" disabled={loading || !shop || !orderNumber}>
          {loading ? "Submitting…" : "Register product"}
        </button>
      </form>
    </CustomerShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="as-shell">
          <BrandLoader label="Opening registration" />
        </div>
      }
    >
      <RegisterInner />
    </Suspense>
  );
}
