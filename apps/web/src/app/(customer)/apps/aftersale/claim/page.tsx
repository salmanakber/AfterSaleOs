"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { publicApiUrl } from "@/lib/public-api";
import {
  saveCustomerOrderSession,
  type CachedOrder,
} from "@/lib/customer-order-session";
import { useCustomerOrderSession } from "@/lib/use-customer-order-session";
import { BrandLoader } from "../../../components/BrandLoader";
import { CustomerShell } from "../../../components/CustomerShell";
import { OrderPicker } from "../../../components/OrderPicker";

function ClaimFormInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const certificateFromUrl = params.get("certificate") ?? "";
  const embed = params.get("embed") === "1";
  const themeLocal = params.get("theme") === "local" || embed;
  const accentOverride = params.get("accent");
  const prefillEmail = params.get("email") ?? "";
  const prefillOrder = params.get("order") ?? "";
  const loggedInCustomerId =
    params.get("logged_in_customer_id") ?? params.get("customer_id") ?? "";
  const query = useMemo(() => params.toString(), [params]);

  const session = useCustomerOrderSession({
    shop,
    emailFromUrl: prefillEmail,
    loggedInCustomerId,
    orderFromUrl: prefillOrder,
  });

  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [certificateToken, setCertificateToken] = useState(certificateFromUrl);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [category, setCategory] = useState("defect");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{
    claimNumber: string;
    trackingUrl: string;
    message: string;
    eligibility: string;
  } | null>(null);

  const showPicker = session.sessionReady && Boolean(session.email && shop);

  useEffect(() => {
    if (certificateFromUrl) setCertificateToken(certificateFromUrl);
  }, [certificateFromUrl]);

  async function requestVerify(e: FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setVerifyMsg(null);
    setError(null);
    try {
      if (!shop) throw new Error("Please open the claim form from your store.");
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
        setVerifyMsg(json.emailHint ?? "Verified — pick the product to claim.");
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
      : undefined;
    if (line) {
      setSelectedLineId(line.id);
      setProductTitle(line.title);
      if (line.certificateToken && !certificateFromUrl) {
        setCertificateToken(line.certificateToken);
      }
    } else {
      setSelectedLineId("");
      setProductTitle("");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const attachmentIds: string[] = [];
      if (files) {
        for (const file of Array.from(files).slice(0, 5)) {
          const fd = new FormData();
          fd.append("file", file);
          const up = await fetch(publicApiUrl(`/api/public/attachments/upload?${query}`), {
            method: "POST",
            body: fd,
          });
          const uj = await up.json();
          if (!up.ok) throw new Error(uj.error ?? "Upload failed");
          attachmentIds.push(uj.id);
        }
      }

      if (!shop) throw new Error("Please open this claim form from your store.");
      const res = await fetch(publicApiUrl(`/api/public/claims?${query}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.email,
          customerName: name || undefined,
          certificateToken: certificateToken || undefined,
          orderNumber: session.orderNumber || undefined,
          serialNumber: serial || undefined,
          issueCategory: category,
          issueSummary: summary,
          issueDetails: details || undefined,
          attachmentIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Claim failed");
      setResult({
        claimNumber: json.claimNumber,
        trackingUrl: json.trackingUrl,
        message: json.message,
        eligibility: json.eligibility,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <CustomerShell
        title="Claim received"
        lede="We’ve logged it and started review."
        shopDomain={shop}
        embed={embed}
        themeLocal={themeLocal}
        accentOverride={accentOverride}
        steps={["Describe", "Evidence", "Submitted"]}
        activeStep={2}
      >
        <div className="as-success-hero">
          <div className="as-success-icon" aria-hidden>
            ✓
          </div>
          <strong
            style={{
              fontSize: "1.5rem",
              fontFamily: "var(--as-font-display), Fraunces, Georgia, serif",
            }}
          >
            {result.claimNumber}
          </strong>
          <p className="as-muted">{result.message}</p>
          <p className="as-muted">Eligibility guide: {result.eligibility.replaceAll("_", " ")}</p>
          <div className="as-actions">
            <a className="as-btn" href={result.trackingUrl}>
              Track this claim
            </a>
          </div>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell
      title="Submit a claim"
      lede="Pick your order and product, then tell us what happened."
      shopDomain={shop}
      embed={embed}
      themeLocal={themeLocal}
      accentOverride={accentOverride}
      steps={["Describe", "Evidence", "Submitted"]}
      activeStep={summary.trim() ? 1 : 0}
    >
      {showPicker && session.hydrated ? (
        <div style={{ marginBottom: 16 }}>
          <OrderPicker
            shop={shop}
            email={session.email}
            selectedOrderNumber={session.orderNumber}
            selectedLineId={selectedLineId}
            mode="line"
            seedOrders={session.orders}
            purpose="claim"
            onSelect={onPickOrder}
          />
        </div>
      ) : null}

      {!session.sessionReady ? (
        <form onSubmit={requestVerify} style={{ marginBottom: 18 }}>
          <p className="as-muted" style={{ marginTop: 0 }}>
            Verify once with the email and order from your purchase. We’ll save your orders in this
            browser so claim and register stay easy.
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
      ) : (
        <div className="as-alert as-alert-ok" style={{ marginBottom: 16 }}>
          Orders loaded for {session.email}. Select a product above, then finish the claim details.
        </div>
      )}

      <form onSubmit={onSubmit}>
        <p className="as-section-title">Contact & product</p>
        <div className="as-field-grid">
          <div>
            <label className="as-label">Email</label>
            <input
              className="as-input"
              type="email"
              required
              value={session.email}
              onChange={(e) => session.setEmail(e.target.value)}
              autoComplete="email"
              readOnly={session.sessionReady}
            />
          </div>
          <div>
            <label className="as-label">Name</label>
            <input className="as-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div className="as-field-grid">
          <div>
            <label className="as-label">Order number</label>
            <input
              className="as-input"
              value={session.orderNumber}
              onChange={(e) => session.setOrderNumber(e.target.value)}
              placeholder="#1001"
            />
          </div>
          <div>
            <label className="as-label">Serial number</label>
            <input className="as-input" value={serial} onChange={(e) => setSerial(e.target.value)} />
          </div>
        </div>

        {productTitle ? (
          <>
            <label className="as-label">Product</label>
            <input className="as-input" value={productTitle} readOnly />
          </>
        ) : null}

        <hr className="as-divider" />
        <p className="as-section-title">What happened</p>

        <label className="as-label">Issue category</label>
        <select className="as-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="defect">Product defect</option>
          <option value="damage">Damage</option>
          <option value="missing_parts">Missing parts</option>
          <option value="performance">Performance</option>
          <option value="other">Other</option>
        </select>

        <label className="as-label">Summary</label>
        <input
          className="as-input"
          required
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Short description of the issue"
        />

        <label className="as-label">Details</label>
        <textarea
          className="as-input"
          rows={4}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          style={{ resize: "vertical", minHeight: 110 }}
          placeholder="When it started, what you tried, and anything else we should know"
        />

        <label className="as-label">Photos / files (max 5)</label>
        <input
          className="as-input"
          type="file"
          accept="image/*,application/pdf,video/mp4"
          multiple
          onChange={(e) => setFiles(e.target.files)}
        />

        {certificateToken ? (
          <p className="as-muted">Linked to warranty certificate for this product.</p>
        ) : null}
        {error ? <div className="as-alert as-alert-error">{error}</div> : null}

        <button className="as-btn" type="submit" disabled={loading || !shop}>
          {loading ? "Submitting…" : "Submit claim"}
        </button>
      </form>
    </CustomerShell>
  );
}

export default function ClaimFormPage() {
  return (
    <Suspense
      fallback={
        <div className="as-shell">
          <BrandLoader label="Opening claim form" />
        </div>
      }
    >
      <ClaimFormInner />
    </Suspense>
  );
}
