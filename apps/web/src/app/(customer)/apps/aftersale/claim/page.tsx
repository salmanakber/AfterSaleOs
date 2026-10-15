"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { publicApiUrl } from "@/lib/public-api";
import {
  saveCustomerOrderSession,
  type CachedOrder,
} from "@/lib/customer-order-session";
import { useCustomerOrderSession } from "@/lib/use-customer-order-session";
import { parseEmbedLayout } from "@/lib/embed-layout";
import { BrandLoader } from "../../../components/BrandLoader";
import {
  ClaimEvidencePicker,
  type EvidenceFile,
} from "../../../components/ClaimEvidencePicker";
import { CustomerShell } from "../../../components/CustomerShell";
import { OrderPicker } from "../../../components/OrderPicker";

const ISSUE_OPTIONS = [
  {
    value: "defect",
    label: "Defect",
    hint: "Arrived broken or faulty",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3 3 19h18L12 3Zm0 5.5v5m0 3.25h.01"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    value: "damage",
    label: "Damage",
    hint: "Cracked, scratched, bent",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 8.5 12 4l8 4.5V16l-8 4.5L4 16V8.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="m8 10 8 5M16 10l-8 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "missing_parts",
    label: "Missing",
    hint: "Parts or accessories gone",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M16.5 7.5h0M7.5 16.5h0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "performance",
    label: "Performance",
    hint: "Doesn’t work as expected",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 16.5 9 11l3.5 3.5L20 7"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M15 7h5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "other",
    label: "Other",
    hint: "Something else",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 8v5m0 3h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

const WIZARD_STEPS = [
  { id: "order", label: "Order", blurb: "Find your purchase" },
  { id: "issue", label: "Issue", blurb: "What went wrong" },
  { id: "evidence", label: "Evidence", blurb: "Photos & files" },
  { id: "review", label: "Review", blurb: "Submit claim" },
] as const;

type WizardStep = (typeof WIZARD_STEPS)[number]["id"];

function ClaimFormInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const certificateFromUrl = params.get("certificate") ?? "";
  const embed = params.get("embed") === "1";
  const themeLocal = params.get("theme") === "local" || embed;
  const accentOverride = params.get("accent");
  const embedLayout = parseEmbedLayout(params);
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

  const [step, setStep] = useState<WizardStep>("order");
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [certificateToken, setCertificateToken] = useState(certificateFromUrl);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [category, setCategory] = useState("defect");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
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
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);
  const categoryMeta = ISSUE_OPTIONS.find((o) => o.value === category);

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

  function goNext() {
    setError(null);
    if (step === "order") {
      if (!session.email.trim()) {
        setError("Enter the email on your order.");
        return;
      }
      if (!session.orderNumber.trim() && !selectedLineId) {
        setError("Find your order, then pick the product.");
        return;
      }
      setStep("issue");
      return;
    }
    if (step === "issue") {
      if (!summary.trim()) {
        setError("Add a short summary of the issue.");
        return;
      }
      setStep("evidence");
      return;
    }
    if (step === "evidence") {
      setStep("review");
    }
  }

  function goBack() {
    setError(null);
    if (step === "issue") setStep("order");
    else if (step === "evidence") setStep("issue");
    else if (step === "review") setStep("evidence");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const attachmentIds: string[] = [];
      for (const item of evidence.slice(0, 5)) {
        const fd = new FormData();
        fd.append("file", item.file);
        const up = await fetch(publicApiUrl(`/api/public/attachments/upload?${query}`), {
          method: "POST",
          body: fd,
        });
        const uj = await up.json();
        if (!up.ok) throw new Error(uj.error ?? "Upload failed");
        attachmentIds.push(uj.id);
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

  const shellProps = {
    shopDomain: shop,
    embed,
    themeLocal,
    accentOverride,
    embedCols: embedLayout.cols,
    embedWidth: embedLayout.width,
    embedStyle: embedLayout.style,
  } as const;

  if (result) {
    return (
      <CustomerShell
        title="Claim received"
        lede="We’ve logged it and started review."
        {...shellProps}
        steps={["Order", "Issue", "Evidence", "Submitted"]}
        activeStep={3}
      >
        <div className="as-claim-success">
          <div className="as-claim-success__mark" aria-hidden>
            ✓
          </div>
          <p className="as-claim-success__kicker">Claim number</p>
          <strong className="as-claim-success__num">{result.claimNumber}</strong>
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
      title="File a claim"
      lede="A short guided flow — order, issue, evidence, done."
      {...shellProps}
      steps={["Order", "Issue", "Evidence", "Review"]}
      activeStep={stepIndex}
    >
      <div className="as-claim-wizard" data-step={step}>
        <nav className="as-claim-rail" aria-label="Claim steps">
          <div
            className="as-claim-rail__fill"
            style={{ width: `${((stepIndex + 1) / WIZARD_STEPS.length) * 100}%` }}
          />
          <ol className="as-claim-rail__list">
            {WIZARD_STEPS.map((s, i) => {
              const state = i < stepIndex ? "done" : i === stepIndex ? "current" : "upcoming";
              return (
                <li key={s.id} data-state={state}>
                  <button
                    type="button"
                    className="as-claim-rail__btn"
                    disabled={i > stepIndex}
                    onClick={() => {
                      if (i < stepIndex) {
                        setError(null);
                        setStep(s.id);
                      }
                    }}
                  >
                    <span className="as-claim-rail__tick" aria-hidden />
                    <span className="as-claim-rail__label">{s.label}</span>
                    <span className="as-claim-rail__blurb">{s.blurb}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="as-claim-panel" key={step}>
          {step === "order" ? (
            <section className="as-claim-step">
              <header className="as-claim-step__head">
                <p className="as-claim-step__eyebrow">Step 1</p>
                <h3 className="as-claim-step__title">Find your order</h3>
                <p className="as-claim-step__lede">
                  Use the email and order number from your purchase receipt.
                </p>
              </header>

              {!session.sessionReady ? (
                <form onSubmit={requestVerify} className="as-claim-block">
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
                      />
                    </div>
                    <div>
                      <label className="as-label">Order number</label>
                      <input
                        className="as-input"
                        required
                        value={session.orderNumber}
                        onChange={(e) => session.setOrderNumber(e.target.value)}
                        placeholder="#1001"
                      />
                    </div>
                  </div>
                  {verifyMsg ? <div className="as-alert as-alert-ok">{verifyMsg}</div> : null}
                  <button className="as-btn as-btn-secondary" type="submit" disabled={verifying || !shop}>
                    {verifying ? "Checking…" : "Find my orders"}
                  </button>
                </form>
              ) : (
                <div className="as-claim-ready">
                  <span className="as-claim-ready__dot" aria-hidden />
                  Orders loaded for <strong>{session.email}</strong>
                </div>
              )}

              {showPicker && session.hydrated ? (
                <div className="as-claim-block as-claim-block--picker">
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

              {productTitle ? (
                <div className="as-claim-product-chip">
                  <span className="as-claim-product-chip__kicker">Claiming</span>
                  <strong>{productTitle}</strong>
                  <span className="as-muted">Order {session.orderNumber}</span>
                </div>
              ) : null}

              <div className="as-field-grid as-claim-contact">
                <div>
                  <label className="as-label">Your name</label>
                  <input
                    className="as-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Optional"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="as-label">Serial number</label>
                  <input
                    className="as-input"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    placeholder="If printed on the product"
                  />
                </div>
              </div>
            </section>
          ) : null}

          {step === "issue" ? (
            <section className="as-claim-step">
              <header className="as-claim-step__head">
                <p className="as-claim-step__eyebrow">Step 2</p>
                <h3 className="as-claim-step__title">What happened?</h3>
                <p className="as-claim-step__lede">Pick a category, then describe the issue in plain language.</p>
              </header>

              <div className="as-claim-cats" role="radiogroup" aria-label="Issue category">
                {ISSUE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={category === opt.value}
                    className={`as-claim-cat${category === opt.value ? " is-selected" : ""}`}
                    onClick={() => setCategory(opt.value)}
                  >
                    <span className="as-claim-cat__icon">{opt.icon}</span>
                    <span className="as-claim-cat__label">{opt.label}</span>
                    <span className="as-claim-cat__hint">{opt.hint}</span>
                  </button>
                ))}
              </div>

              <div className="as-claim-block">
                <div className="as-field-grid">
                  <div className="as-field-span">
                    <label className="as-label">Summary</label>
                    <input
                      className="as-input"
                      required
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="One line — e.g. Screen flickers after 10 minutes"
                    />
                  </div>
                  <div className="as-field-span">
                    <label className="as-label">Details</label>
                    <textarea
                      className="as-input as-input-compact"
                      rows={4}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="When it started, what you tried, anything else we should know…"
                    />
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {step === "evidence" ? (
            <section className="as-claim-step">
              <header className="as-claim-step__head">
                <p className="as-claim-step__eyebrow">Step 3</p>
                <h3 className="as-claim-step__title">Add evidence</h3>
                <p className="as-claim-step__lede">
                  Photos beat paragraphs. Optional, but claims with clear images move faster.
                </p>
              </header>
              <ClaimEvidencePicker files={evidence} onChange={setEvidence} />
            </section>
          ) : null}

          {step === "review" ? (
            <section className="as-claim-step">
              <header className="as-claim-step__head">
                <p className="as-claim-step__eyebrow">Step 4</p>
                <h3 className="as-claim-step__title">Review &amp; submit</h3>
                <p className="as-claim-step__lede">Confirm the details — you can go back to edit any step.</p>
              </header>

              <div className="as-claim-review">
                <article className="as-claim-review__card">
                  <h4>Product</h4>
                  <p>{productTitle || "Selected from order"}</p>
                  <dl>
                    <div>
                      <dt>Order</dt>
                      <dd>{session.orderNumber || "—"}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{session.email || "—"}</dd>
                    </div>
                    {serial ? (
                      <div>
                        <dt>Serial</dt>
                        <dd>{serial}</dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
                <article className="as-claim-review__card">
                  <h4>Issue</h4>
                  <p className="as-claim-review__cat">
                    {categoryMeta?.label ?? category} · {summary}
                  </p>
                  {details ? <p className="as-muted">{details}</p> : null}
                </article>
                <article className="as-claim-review__card">
                  <h4>Evidence</h4>
                  {evidence.length === 0 ? (
                    <p className="as-muted">No files attached — you can still submit.</p>
                  ) : (
                    <ul className="as-claim-review__files">
                      {evidence.map((f) => (
                        <li key={f.id}>{f.file.name}</li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              {certificateToken ? (
                <p className="as-muted as-claim-cert">Linked to a warranty certificate for this product.</p>
              ) : null}

              <form onSubmit={onSubmit} className="as-claim-submit-row">
                <button className="as-btn as-claim-submit" type="submit" disabled={loading || !shop}>
                  {loading ? "Submitting…" : "Submit claim"}
                </button>
              </form>
            </section>
          ) : null}
        </div>

        {error ? <div className="as-alert as-alert-error">{error}</div> : null}

        {step !== "review" ? (
          <div className="as-claim-nav">
            {stepIndex > 0 ? (
              <button type="button" className="as-btn as-btn-ghost" onClick={goBack}>
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="as-btn" onClick={goNext} disabled={!shop}>
              Continue
            </button>
          </div>
        ) : (
          <div className="as-claim-nav">
            <button type="button" className="as-btn as-btn-ghost" onClick={goBack} disabled={loading}>
              Back
            </button>
            <span className="as-muted as-claim-nav__hint">Ready when you are</span>
          </div>
        )}
      </div>
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
