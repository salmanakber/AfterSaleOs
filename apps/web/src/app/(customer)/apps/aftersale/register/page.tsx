"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { customerPageUrl, publicApiUrl } from "@/lib/public-api";
import { BrandLoader } from "../../../components/BrandLoader";
import { CustomerShell } from "../../../components/CustomerShell";

function RegisterInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const productTitle = params.get("product") ?? "";
  const productId = params.get("product_id") ?? "";
  const variantId = params.get("variant_id") ?? "";
  const qr = params.get("qr") ?? "";
  const embed = params.get("embed") === "1";
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

  const query = useMemo(() => params.toString(), [params]);
  const done = Boolean(cert || message);

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
          : "Enter your order details to activate coverage."
      }
      shopDomain={shop}
      embed={embed}
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
      {auto ? (
        <div className="as-alert as-alert-ok">
          Registering from your order — no extra email verification needed for this purchase.
        </div>
      ) : null}

      <form onSubmit={onSubmit}>
        <label className="as-label">Email</label>
        <input
          className="as-input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

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

        <label className="as-label">Order number</label>
        <input
          className="as-input"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="#1001"
          required
        />

        <label className="as-label">Serial number</label>
        <input
          className="as-input"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="If your product requires one"
        />

        {error ? <div className="as-alert as-alert-error">{error}</div> : null}

        <button className="as-btn" type="submit" disabled={loading || !shop}>
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
