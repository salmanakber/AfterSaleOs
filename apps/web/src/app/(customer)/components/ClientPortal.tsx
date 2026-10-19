"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { customerPageUrl, publicApiUrl } from "@/lib/public-api";
import {
  clearCustomerOrderSession,
  saveCustomerOrderSession,
  type CachedOrder,
  type CachedWarranty,
} from "@/lib/customer-order-session";
import { ProductSearchSelect, type PickedProduct } from "./ProductSearchSelect";
import { formatWarrantyFee, type FeePaymentInfo } from "@/lib/warranty-fee";
import { downloadQrPng, printQrSheet, qrImageUrl } from "@/lib/qr-display";
import type { QrScanContext } from "./GuestRegisterFlow";

export type PortalView = "home" | "activate" | "products" | "claim" | "requests";

type ClaimRow = {
  id: string;
  claimNumber: string;
  status: string;
  issueSummary: string | null;
  productTitle: string | null;
  createdAt: string;
  trackingUrl: string;
};

const NAV: { id: PortalView; label: string; blurb: string; icon: string }[] = [
  { id: "home", label: "Home", blurb: "Your care desk", icon: "◈" },
  { id: "activate", label: "Activate warranty", blurb: "Register a product", icon: "✦" },
  { id: "products", label: "My products", blurb: "Registered coverage", icon: "▣" },
  { id: "claim", label: "File a claim", blurb: "Report an issue", icon: "◇" },
  { id: "requests", label: "My requests", blurb: "Claim history", icon: "☰" },
];

function statusPretty(s: string) {
  return s.replaceAll("_", " ");
}

export function ClientPortal({
  shop,
  shopName,
  email,
  orders,
  warranties,
  embed,
  initialView = "home",
  qrContext = null,
  pendingFeePayment = null,
  onDismissFeePayment,
  onLogout,
  onSessionRefresh,
}: {
  shop: string;
  shopName?: string;
  email: string;
  orders: CachedOrder[];
  warranties: CachedWarranty[];
  embed?: boolean;
  initialView?: PortalView;
  qrContext?: QrScanContext | null;
  pendingFeePayment?: FeePaymentInfo | null;
  onDismissFeePayment?: () => void;
  onLogout: () => void;
  onSessionRefresh?: () => void;
}) {
  const [view, setView] = useState<PortalView>(initialView);
  const [picked, setPicked] = useState<PickedProduct | null>(null);
  const [shareQr, setShareQr] = useState<{ title: string; url: string } | null>(null);
  const [qrPrefillDone, setQrPrefillDone] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serial, setSerial] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [regBusy, setRegBusy] = useState(false);
  const [regMsg, setRegMsg] = useState<string | null>(null);
  const [regErr, setRegErr] = useState<string | null>(null);
  const [feePay, setFeePay] = useState<FeePaymentInfo | null>(pendingFeePayment);

  useEffect(() => {
    if (pendingFeePayment) setFeePay(pendingFeePayment);
  }, [pendingFeePayment]);

  const [claimSummary, setClaimSummary] = useState("");
  const [claimDetails, setClaimDetails] = useState("");
  const [claimCategory, setClaimCategory] = useState("defect");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [claimOk, setClaimOk] = useState<{ claimNumber: string; trackingUrl: string } | null>(null);

  const [requests, setRequests] = useState<ClaimRow[] | null>(null);
  const [reqBusy, setReqBusy] = useState(false);

  const brand = shopName || "Your store";

  const loadRequests = useCallback(async () => {
    if (!shop || !email) return;
    setReqBusy(true);
    try {
      const res = await fetch(publicApiUrl("/api/public/customer-claims"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load requests");
      setRequests(json.claims ?? []);
    } catch {
      setRequests([]);
    } finally {
      setReqBusy(false);
    }
  }, [shop, email]);

  useEffect(() => {
    if (view === "requests" || view === "home") void loadRequests();
  }, [view, loadRequests]);

  useEffect(() => {
    if (picked?.orderNumber) setOrderNumber(picked.orderNumber);
  }, [picked?.orderNumber]);

  // Prefill activate form from an incoming QR scan.
  useEffect(() => {
    if (!shop || !qrContext || qrPrefillDone) return;
    let cancelled = false;
    (async () => {
      try {
        if (qrContext.productTitle && (qrContext.shopifyProductId || qrContext.productId)) {
          if (!cancelled) {
            setPicked({
              source: "catalog",
              title: qrContext.productTitle,
              shopifyProductId: qrContext.shopifyProductId || qrContext.productId || undefined,
              imageUrl: qrContext.productImageUrl,
            });
            setView("activate");
          }
          return;
        }
        if (qrContext.productId) {
          const res = await fetch(
            publicApiUrl(
              `/api/public/products?shop=${encodeURIComponent(shop)}&product_id=${encodeURIComponent(qrContext.productId)}&limit=1`,
            ),
          );
          const json = await res.json();
          const p = json.products?.[0];
          if (p && !cancelled) {
            setPicked({
              source: "catalog",
              title: p.title,
              shopifyProductId: p.shopifyProductId,
              imageUrl: p.imageUrl,
            });
            setView("activate");
          }
        } else if (!cancelled) {
          setView("activate");
        }
      } finally {
        if (!cancelled) setQrPrefillDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shop, qrContext, qrPrefillDone]);

  function productShareUrl(w: CachedWarranty) {
    const p = new URLSearchParams({ shop, view: "activate", source: "share" });
    if (w.productTitle) p.set("qr_label", w.productTitle);
    return `${typeof window !== "undefined" ? window.location.origin : ""}/apps/aftersale/portal?${p.toString()}`;
  }

  const qs = useMemo(() => {
    const p = new URLSearchParams({ shop });
    if (email) p.set("email", email);
    return p.toString();
  }, [shop, email]);

  async function submitRegister(e: FormEvent) {
    e.preventDefault();
    setRegBusy(true);
    setRegErr(null);
    setRegMsg(null);
    try {
      if (!picked?.title) throw new Error("Choose a product first.");
      const res = await fetch(publicApiUrl(`/api/public/register?shop=${encodeURIComponent(shop)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          serialNumber: serial || undefined,
          orderNumber: orderNumber || picked.orderNumber || undefined,
          productTitle: picked.title,
          shopifyProductId: picked.shopifyProductId,
          shopifyVariantId: picked.shopifyVariantId,
          outsideShopify: picked.source === "catalog" && !picked.orderNumber,
          source: qrContext?.code ? "qr" : "portal",
          qrCode: qrContext?.code || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Registration failed");
      if (json.paymentRequired && json.feeCheckoutUrl) {
        setFeePay({
          checkoutUrl: json.feeCheckoutUrl,
          label: json.feeLabel || "Warranty registration",
          cents: typeof json.feeCents === "number" ? json.feeCents : null,
          currency: json.currency || "USD",
          registrationId: json.registrationId || "",
        });
        setRegMsg(json.message ?? "Pay the registration fee to activate coverage.");
      } else {
        setRegMsg(json.message ?? "Product registered.");
        setFeePay(null);
      }
      setPicked(null);
      setSerial("");
      onSessionRefresh?.();
      setView("products");
    } catch (err) {
      setRegErr(err instanceof Error ? err.message : "Failed");
    } finally {
      setRegBusy(false);
    }
  }

  const feePriceLabel = feePay ? formatWarrantyFee(feePay.cents, feePay.currency) : null;

  async function submitClaim(e: FormEvent) {
    e.preventDefault();
    setClaimBusy(true);
    setClaimErr(null);
    setClaimOk(null);
    try {
      if (!claimSummary.trim()) throw new Error("Add a short summary.");
      const res = await fetch(publicApiUrl(`/api/public/claims?${qs}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          orderNumber: orderNumber || picked?.orderNumber || undefined,
          issueCategory: claimCategory,
          issueSummary: claimSummary,
          issueDetails: claimDetails || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Claim failed");
      setClaimOk({ claimNumber: json.claimNumber, trackingUrl: json.trackingUrl });
      setClaimSummary("");
      setClaimDetails("");
      void loadRequests();
    } catch (err) {
      setClaimErr(err instanceof Error ? err.message : "Failed");
    } finally {
      setClaimBusy(false);
    }
  }

  return (
    <div className={`as-dash${embed ? " as-dash--embed" : ""}`}>
      <aside className="as-dash-nav" aria-label="Portal">
        <div className="as-dash-nav__brand">
          <p className="as-dash-nav__kicker">Client portal</p>
          <strong>{brand}</strong>
          <span className="as-dash-nav__email">{email}</span>
        </div>
        <nav className="as-dash-nav__list">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="as-dash-nav__btn"
              data-active={view === item.id}
              onClick={() => setView(item.id)}
            >
              <span className="as-dash-nav__icon" aria-hidden>
                {item.icon}
              </span>
              <span className="as-dash-nav__copy">
                <span>{item.label}</span>
                <em>{item.blurb}</em>
              </span>
            </button>
          ))}
        </nav>
        <button type="button" className="as-dash-nav__out" onClick={onLogout}>
          Sign out
        </button>
      </aside>

      <main className="as-dash-main">
        {feePay ? (
          <div className="as-fee-banner" role="status">
            <div>
              <strong>Pay to activate</strong>
              <p>
                {feePay.label}
                {feePriceLabel ? ` · ${feePriceLabel}` : ""} — complete checkout on the store to
                activate your warranty.
              </p>
            </div>
            <div className="as-fee-banner__actions">
              <a className="as-btn" href={feePay.checkoutUrl} target="_top" rel="noopener noreferrer">
                Pay{feePriceLabel ? ` ${feePriceLabel}` : ""} &amp; activate
              </a>
              <button
                type="button"
                className="as-btn as-btn-ghost"
                onClick={() => {
                  setFeePay(null);
                  onDismissFeePayment?.();
                }}
              >
                Later
              </button>
            </div>
          </div>
        ) : null}

        {view === "home" ? (
          <section className="as-dash-home">
            <header className="as-dash-hero">
              <div className="as-dash-hero__copy">
                <p className="as-dash-head__kicker">Welcome back</p>
                <h2>Your warranty desk</h2>
                <p>Activate coverage, review products, or file a claim — all in one place.</p>
              </div>
              <div className="as-dash-hero__stats" aria-label="Quick stats">
                <div>
                  <strong>{warranties.length}</strong>
                  <span>Products</span>
                </div>
                <div>
                  <strong>{orders.length}</strong>
                  <span>Orders</span>
                </div>
                <div>
                  <strong>{requests?.length ?? "—"}</strong>
                  <span>Requests</span>
                </div>
              </div>
            </header>
            <div className="as-dash-cards">
              {(
                [
                  ["activate", "✦", "Activate warranty", "Register from the store catalog or a past order"],
                  ["products", "▣", "My products", `${warranties.length} registered · certificates ready`],
                  ["claim", "◇", "File a claim", "Tell us what went wrong — we’ll guide next steps"],
                  ["requests", "☰", "My requests", "Track open and past claims in one list"],
                ] as const
              ).map(([id, icon, title, sub]) => (
                <button
                  key={id}
                  type="button"
                  className="as-dash-card"
                  onClick={() => setView(id)}
                >
                  <span className="as-dash-card__icon" aria-hidden>
                    {icon}
                  </span>
                  <strong>{title}</strong>
                  <span>{sub}</span>
                  <em className="as-dash-card__go">Open →</em>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {view === "activate" ? (
          <section className="as-dash-panel">
            <header className="as-dash-head">
              <p className="as-dash-head__kicker">{qrContext?.code ? "QR scan" : "Activate"}</p>
              <h2>
                {qrContext?.label || qrContext?.productTitle
                  ? `Register ${qrContext.label || qrContext.productTitle}`
                  : "Register a product"}
              </h2>
              <p>
                {qrContext?.code
                  ? "This product came from your QR scan — confirm details to activate coverage."
                  : "Search the store catalog or pick something from your recent orders."}
              </p>
            </header>
            {qrContext?.code ? (
              <div className="as-qr-portal-banner">
                <span className="as-qr-portal-banner__badge">Scanned</span>
                <div>
                  <strong>{qrContext.label || qrContext.productTitle || `Code ${qrContext.code}`}</strong>
                  <em>Source QR · {qrContext.code}</em>
                </div>
              </div>
            ) : null}
            <form className="as-dash-form" onSubmit={submitRegister}>
              <ProductSearchSelect
                shop={shop}
                orders={orders}
                value={picked}
                onChange={setPicked}
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
                  <label className="as-label">Serial (optional)</label>
                  <input className="as-input" value={serial} onChange={(e) => setSerial(e.target.value)} />
                </div>
              </div>
              {regErr ? <div className="as-alert as-alert-error">{regErr}</div> : null}
              {regMsg ? <div className="as-alert as-alert-ok">{regMsg}</div> : null}
              <button className="as-btn" type="submit" disabled={regBusy || !shop}>
                {regBusy ? "Registering…" : "Activate warranty"}
              </button>
            </form>
          </section>
        ) : null}

        {view === "products" ? (
          <section className="as-dash-panel">
            <header className="as-dash-head">
              <p className="as-dash-head__kicker">Coverage</p>
              <h2>My registered products</h2>
              <p>Certificates and status for products you’ve activated.</p>
            </header>
            {warranties.length === 0 ? (
              <div className="as-dash-empty">
                <strong>No products yet</strong>
                <p>Activate a warranty to see it here.</p>
                <button type="button" className="as-btn" onClick={() => setView("activate")}>
                  Activate warranty
                </button>
              </div>
            ) : (
              <ul className="as-dash-list">
                {warranties.map((w) => (
                  <li key={w.id} className="as-dash-list__item">
                    <div>
                      <strong>{w.productTitle || "Product"}</strong>
                      <span>
                        {statusPretty(w.status)}
                        {w.orderNumber ? ` · Order ${w.orderNumber}` : ""}
                        {w.endAt ? ` · Ends ${new Date(w.endAt).toLocaleDateString()}` : ""}
                      </span>
                    </div>
                    <div className="as-dash-list__actions">
                      <button
                        type="button"
                        className="as-btn as-btn-secondary"
                        onClick={() =>
                          setShareQr({
                            title: w.productTitle || "Product",
                            url: productShareUrl(w),
                          })
                        }
                      >
                        My QR
                      </button>
                      {w.certificateToken ? (
                        <a
                          className="as-btn as-btn-secondary"
                          href={customerPageUrl(
                            `/c/${w.certificateToken}?shop=${encodeURIComponent(shop)}`,
                          )}
                        >
                          Certificate
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {view === "claim" ? (
          <section className="as-dash-panel">
            <header className="as-dash-head">
              <p className="as-dash-head__kicker">Support</p>
              <h2>File a claim</h2>
              <p>Tell us about the issue. We’ll email you when there’s an update.</p>
            </header>
            {claimOk ? (
              <div className="as-dash-success">
                <strong>{claimOk.claimNumber}</strong>
                <p>Claim submitted. Track progress anytime.</p>
                <a className="as-btn" href={claimOk.trackingUrl}>
                  Track claim
                </a>
                <button type="button" className="as-btn as-btn-ghost" onClick={() => setView("requests")}>
                  View my requests
                </button>
              </div>
            ) : (
              <form className="as-dash-form" onSubmit={submitClaim}>
                <ProductSearchSelect shop={shop} orders={orders} value={picked} onChange={setPicked} />
                <div className="as-field-grid">
                  <div>
                    <label className="as-label">Category</label>
                    <select
                      className="as-input"
                      value={claimCategory}
                      onChange={(e) => setClaimCategory(e.target.value)}
                    >
                      <option value="defect">Product defect</option>
                      <option value="damage">Damage</option>
                      <option value="missing_parts">Missing parts</option>
                      <option value="performance">Performance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="as-label">Order number</label>
                    <input
                      className="as-input"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="as-field-span">
                    <label className="as-label">Summary</label>
                    <input
                      className="as-input"
                      required
                      value={claimSummary}
                      onChange={(e) => setClaimSummary(e.target.value)}
                      placeholder="Short description"
                    />
                  </div>
                  <div className="as-field-span">
                    <label className="as-label">Details</label>
                    <textarea
                      className="as-input as-input-compact"
                      rows={3}
                      value={claimDetails}
                      onChange={(e) => setClaimDetails(e.target.value)}
                    />
                  </div>
                </div>
                {claimErr ? <div className="as-alert as-alert-error">{claimErr}</div> : null}
                <button className="as-btn" type="submit" disabled={claimBusy}>
                  {claimBusy ? "Submitting…" : "Submit claim"}
                </button>
              </form>
            )}
          </section>
        ) : null}

        {view === "requests" ? (
          <section className="as-dash-panel">
            <header className="as-dash-head">
              <p className="as-dash-head__kicker">History</p>
              <h2>My requests</h2>
              <p>Open and past claims for {email}.</p>
            </header>
            {reqBusy && !requests ? <p className="as-muted">Loading…</p> : null}
            {requests && requests.length === 0 ? (
              <div className="as-dash-empty">
                <strong>No claims yet</strong>
                <button type="button" className="as-btn" onClick={() => setView("claim")}>
                  File a claim
                </button>
              </div>
            ) : null}
            {requests && requests.length > 0 ? (
              <ul className="as-dash-list">
                {requests.map((c) => (
                  <li key={c.id} className="as-dash-list__item">
                    <div>
                      <strong>{c.claimNumber}</strong>
                      <span>
                        {statusPretty(c.status)}
                        {c.productTitle ? ` · ${c.productTitle}` : ""}
                        {c.issueSummary ? ` · ${c.issueSummary}` : ""}
                      </span>
                    </div>
                    <a className="as-btn as-btn-secondary" href={c.trackingUrl}>
                      Track
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {shareQr ? (
          <div
            className="as-qr-share"
            role="dialog"
            aria-modal="true"
            aria-label="Share product QR"
          >
            <div className="as-qr-share__card">
              <button
                type="button"
                className="as-qr-share__close"
                onClick={() => setShareQr(null)}
                aria-label="Close"
              >
                ×
              </button>
              <p className="as-qr-share__kicker">Your product QR</p>
              <h3>{shareQr.title}</h3>
              <p className="as-muted">Share or print this code so others can open registration for this product.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImageUrl(shareQr.url, 280)} alt="" width={200} height={200} />
              <div className="as-qr-share__actions">
                <button
                  type="button"
                  className="as-btn"
                  onClick={() => void downloadQrPng(shareQr.url, `warranty-${shareQr.title}`, 720)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="as-btn as-btn-secondary"
                  onClick={() =>
                    printQrSheet({
                      title: shareQr.title,
                      subtitle: shopName || shop,
                      url: shareQr.url,
                      imageUrl: qrImageUrl(shareQr.url, 560),
                    })
                  }
                >
                  Print
                </button>
                <button
                  type="button"
                  className="as-btn as-btn-ghost"
                  onClick={() => void navigator.clipboard.writeText(shareQr.url)}
                >
                  Copy link
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export function clearPortalSession(shop: string) {
  clearCustomerOrderSession(shop);
}

export function persistPortalSession(params: {
  shop: string;
  email: string;
  orders: CachedOrder[];
  warranties: CachedWarranty[];
}) {
  saveCustomerOrderSession({
    shop: params.shop,
    email: params.email,
    orders: params.orders,
    warranties: params.warranties,
    source: "portal",
  });
}
