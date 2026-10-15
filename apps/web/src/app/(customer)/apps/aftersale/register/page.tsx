"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { customerPageUrl, publicApiUrl } from "@/lib/public-api";
import {
  saveCustomerOrderSession,
  type CachedOrder,
} from "@/lib/customer-order-session";
import { useCustomerOrderSession } from "@/lib/use-customer-order-session";
import { BrandLoader } from "../../../components/BrandLoader";
import { CustomerShell } from "../../../components/CustomerShell";
import { OrderPicker } from "../../../components/OrderPicker";

function RegisterInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const productTitleParam = params.get("product") ?? "";
  const productIdParam = params.get("product_id") ?? "";
  const variantIdParam = params.get("variant_id") ?? "";
  const qr = params.get("qr") ?? "";
  const embed = params.get("embed") === "1";
  const themeLocal = params.get("theme") === "local" || embed;
  const accentOverride = params.get("accent");
  const auto = params.get("auto") === "1";
  const prefillEmail = params.get("email") ?? "";
  const prefillOrder = params.get("order") ?? "";
  const loggedInCustomerId =
    params.get("logged_in_customer_id") ?? params.get("customer_id") ?? "";

  const session = useCustomerOrderSession({
    shop,
    emailFromUrl: prefillEmail,
    loggedInCustomerId,
    orderFromUrl: prefillOrder,
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serial, setSerial] = useState("");
  const [productTitle, setProductTitle] = useState(productTitleParam);
  const [productId, setProductId] = useState(productIdParam);
  const [variantId, setVariantId] = useState(variantIdParam);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [cert, setCert] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const query = useMemo(() => params.toString(), [params]);
  const done = Boolean(cert || message);
  const showPicker = session.sessionReady && Boolean(session.email && shop);

  useEffect(() => {
    if (productTitleParam) setProductTitle(productTitleParam);
    if (productIdParam) setProductId(productIdParam);
    if (variantIdParam) setVariantId(variantIdParam);
  }, [productTitleParam, productIdParam, variantIdParam]);

  async function requestVerify(e: FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setVerifyMsg(null);
    setError(null);
    try {
      if (!shop) throw new Error("Please open registration from your store.");
      const res = await fetch(publicApiUrl(`/api/public/guest-link?shop=${encodeURIComponent(shop)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.email,
          orderNumber: session.orderNumber,
          shop,
        }),
      });
      const json = await res.json();
      if (json.portal?.orders?.length) {
        const orders = json.portal.orders as CachedOrder[];
        session.setOrders(orders);
        session.setSessionReady(true);
        session.setOrderNumber(orders[0]?.orderNumber ?? session.orderNumber);
        if (json.portal.email) session.setEmail(json.portal.email);
        saveCustomerOrderSession({
          shop,
          email: json.portal.email ?? session.email,
          orders,
          warranties: json.portal.warranties ?? [],
          source: "guest_verify",
        });
        setVerifyMsg(json.emailHint ?? "Verified — pick which product to register.");
      } else {
        setVerifyMsg(json.message ?? "If we find a matching order, you will receive an email shortly.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  function onPickOrder(o: CachedOrder, lineItemId?: string) {
    session.setOrderNumber(o.orderNumber);
    const line = lineItemId
      ? o.lineItems.find((li) => li.id === lineItemId)
      : o.lineItems[0];
    if (line) {
      setSelectedLineId(line.id);
      setProductTitle(line.title);
      setProductId(line.shopifyProductId ?? "");
      setVariantId(line.shopifyVariantId ?? "");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!shop) throw new Error("Please open this registration page from your store.");
      const res = await fetch(publicApiUrl(`/api/public/register?${query}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.email,
          firstName,
          lastName,
          serialNumber: serial || undefined,
          orderNumber: session.orderNumber || undefined,
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
          : "Choose your order and product, then activate coverage."
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
          Please open registration from your store’s warranty link, QR code, or product page.
        </div>
      ) : null}
      {auto || session.sessionReady ? (
        <div className="as-alert as-alert-ok">
          {session.sessionReady
            ? "Your orders are ready — pick the product to register."
            : "Registering from your order — no extra email verification needed for this purchase."}
        </div>
      ) : null}

      {showPicker && session.hydrated ? (
        <div style={{ marginBottom: 16 }}>
          <OrderPicker
            shop={shop}
            email={session.email}
            selectedOrderNumber={session.orderNumber}
            selectedLineId={selectedLineId}
            mode="line"
            seedOrders={session.orders}
            purpose="register"
            onSelect={onPickOrder}
          />
        </div>
      ) : null}

      {!session.sessionReady ? (
        <form onSubmit={requestVerify} style={{ marginBottom: 18 }}>
          <p className="as-muted" style={{ marginTop: 0 }}>
            Verify once with the email and order number from your purchase. We’ll remember your
            orders in this browser so you can pick products on register and claim pages.
          </p>
          <label className="as-label">Email</label>
          <input
            className="as-input"
            type="email"
            required
            value={session.email}
            onChange={(e) => session.setEmail(e.target.value)}
            autoComplete="email"
          />
          <label className="as-label">Order number</label>
          <input
            className="as-input"
            required
            value={session.orderNumber}
            onChange={(e) => session.setOrderNumber(e.target.value)}
            placeholder="#1001"
          />
          {verifyMsg ? <div className="as-alert as-alert-ok">{verifyMsg}</div> : null}
          <button className="as-btn as-btn-secondary" type="submit" disabled={verifying || !shop}>
            {verifying ? "Checking…" : "Find my orders"}
          </button>
        </form>
      ) : null}

      <form onSubmit={onSubmit}>
        {session.sessionReady ? (
          <>
            <label className="as-label">Email</label>
            <input className="as-input" type="email" required value={session.email} readOnly />
            <label className="as-label">Order number</label>
            <input
              className="as-input"
              required
              value={session.orderNumber}
              onChange={(e) => session.setOrderNumber(e.target.value)}
              placeholder="Select an order above or type #"
            />
            {productTitle ? (
              <>
                <label className="as-label">Product</label>
                <input className="as-input" value={productTitle} readOnly />
              </>
            ) : null}
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

        <button
          className="as-btn"
          type="submit"
          disabled={loading || !shop || !session.orderNumber}
        >
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
