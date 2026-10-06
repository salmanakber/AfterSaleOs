"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { publicApiUrl } from "@/lib/public-api";
import { BrandLoader } from "../../../components/BrandLoader";
import { CustomerShell } from "../../../components/CustomerShell";
import { OrderPicker } from "../../../components/OrderPicker";

function ClaimFormInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const certificateToken = params.get("certificate") ?? "";
  const embed = params.get("embed") === "1";
  const themeLocal = params.get("theme") === "local" || embed;
  const accentOverride = params.get("accent");
  const prefillEmail = params.get("email") ?? "";
  const query = useMemo(() => params.toString(), [params]);

  const [email, setEmail] = useState(prefillEmail);
  const [name, setName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [serial, setSerial] = useState("");
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

  const loggedInEmail = Boolean(prefillEmail);

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

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
        setVerifyMsg(json.emailHint ?? "Verified — you can continue your claim.");
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

      if (!shop) throw new Error("Missing shop. Open this claim form from your store or embed.");
      const res = await fetch(publicApiUrl(`/api/public/claims?${query}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          customerName: name || undefined,
          certificateToken: certificateToken || undefined,
          orderNumber: orderNumber || undefined,
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
      lede="Tell us what happened. Photos help us resolve faster."
      shopDomain={shop}
      embed={embed}
      themeLocal={themeLocal}
      accentOverride={accentOverride}
      steps={["Describe", "Evidence", "Submitted"]}
      activeStep={summary.trim() ? 1 : 0}
    >
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
      ) : (
        <form onSubmit={requestVerify} style={{ marginBottom: 18 }}>
          <p className="as-muted" style={{ marginTop: 0 }}>
            Verify with the email and order from your purchase first — then finish the claim details.
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              readOnly={loggedInEmail}
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
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="#1001"
            />
          </div>
          <div>
            <label className="as-label">Serial number</label>
            <input className="as-input" value={serial} onChange={(e) => setSerial(e.target.value)} />
          </div>
        </div>

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

        {certificateToken ? <p className="as-muted">Linked to your warranty certificate.</p> : null}
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
