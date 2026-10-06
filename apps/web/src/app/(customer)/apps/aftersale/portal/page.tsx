"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { customerPageUrl, publicApiUrl } from "@/lib/public-api";
import { BrandLoader } from "../../../components/BrandLoader";
import { CustomerShell } from "../../../components/CustomerShell";

type WarrantyRow = {
  id: string;
  status: string;
  productTitle: string;
  orderNumber: string;
  serialNumber: string | null;
  certificateToken: string;
  startAt: string | null;
  endAt: string | null;
  ruleName?: string;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  processedAt: string;
  lineItems: Array<{
    id: string;
    title: string;
    quantity: number;
    shopifyProductId: string | null;
    shopifyVariantId: string | null;
    hasWarranty: boolean;
    certificateToken: string | null;
  }>;
};

const CACHE_KEY = "aftersale.portal.v1";

function PortalInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const token = params.get("token");
  const embed = params.get("embed") === "1";
  const themeLocal = params.get("theme") === "local" || embed;
  const accentOverride = params.get("accent");
  const prefillEmail = params.get("email") ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [warranties, setWarranties] = useState<WarrantyRow[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  // Restore cached session for this shop
  useEffect(() => {
    if (!shop || token) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        shop?: string;
        email?: string;
        warranties?: WarrantyRow[];
        orders?: OrderRow[];
        at?: number;
      };
      if (parsed.shop !== shop) return;
      if (!parsed.at || Date.now() - parsed.at > 1000 * 60 * 60 * 12) return;
      setSessionEmail(parsed.email ?? null);
      setWarranties(parsed.warranties ?? []);
      setOrders(parsed.orders ?? []);
    } catch {
      /* ignore */
    }
  }, [shop, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(publicApiUrl("/api/public/portal"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Invalid link");
        if (cancelled) return;
        setSessionEmail(json.email ?? null);
        setWarranties(json.warranties ?? []);
        setOrders(json.orders ?? null);
        cachePortal(shop, json.email, json.warranties ?? [], json.orders ?? []);
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : "Could not open portal");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, shop]);

  function cachePortal(
    shopDomain: string,
    em: string | null | undefined,
    w: WarrantyRow[],
    o: OrderRow[],
  ) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ shop: shopDomain, email: em, warranties: w, orders: o, at: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }

  async function requestLink(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (!shop) {
        setMessage("Missing shop. Open this portal from your store link or embed.");
        setLoading(false);
        return;
      }
      const res = await fetch(publicApiUrl(`/api/public/guest-link?shop=${encodeURIComponent(shop)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orderNumber, shop }),
      });
      const json = await res.json();
      if (json.portal?.warranties) {
        setSessionEmail(json.portal.email);
        setWarranties(json.portal.warranties);
        setOrders(json.portal.orders ?? []);
        cachePortal(shop, json.portal.email, json.portal.warranties, json.portal.orders ?? []);
        setMessage(json.emailHint ?? "Portal opened.");
      } else {
        setMessage(json.message ?? "If we find a matching order, you will receive an email shortly.");
      }
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

  function registerHref(item: OrderRow["lineItems"][number], orderNum: string) {
    return customerPageUrl("/apps/aftersale/register", shop, {
      product: item.title,
      product_id: item.shopifyProductId ?? "",
      variant_id: item.shopifyVariantId ?? "",
      order: orderNum,
      email: sessionEmail ?? email,
      auto: "1",
    });
  }

  const open = Boolean(warranties);

  if (loading && !open) {
    return (
      <div className="as-shell">
        <BrandLoader label="Opening your portal" />
      </div>
    );
  }

  return (
    <CustomerShell
      title="Your warranties"
      lede="Find coverage, register products from your orders, or start a claim."
      shopDomain={shop}
      embed={embed}
      themeLocal={themeLocal}
      accentOverride={accentOverride}
      steps={open ? ["Verify", "Your orders", "Manage"] : ["Verify", "Open portal", "Manage"]}
      activeStep={open ? 1 : 0}
      footer={
        <a
          className="as-link"
          href={customerPageUrl("/apps/aftersale/register", shop, {
            email: sessionEmail || email || undefined,
          })}
        >
          Register a product not in your orders →
        </a>
      }
    >
      {open ? (
        <div className="as-stack">
          {message ? <div className="as-alert as-alert-ok">{message}</div> : null}

          {orders && orders.length > 0 ? (
            <section className="as-stack">
              <div className="as-section-head">
                <div>
                  <h2>Your orders</h2>
                  <p className="as-muted" style={{ margin: "4px 0 0" }}>
                    Pick a product to register — no extra confirmation for items from these orders.
                  </p>
                </div>
              </div>
              {orders.map((o) => (
                <article className="as-card" key={o.id}>
                  <div className="as-warranty-row">
                    <h3 className="as-warranty-title" style={{ fontSize: "1.05rem" }}>
                      Order {o.orderNumber}
                    </h3>
                    <span className="as-chip">{new Date(o.processedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="as-stack" style={{ gap: 8, marginTop: 10 }}>
                    {o.lineItems.map((li) => (
                      <div key={li.id} className="as-line-row">
                        <div>
                          <strong>{li.title}</strong>
                          <div className="as-muted" style={{ fontSize: 12 }}>
                            Qty {li.quantity}
                            {li.hasWarranty ? " · Covered" : " · Not registered yet"}
                          </div>
                        </div>
                        {li.hasWarranty && li.certificateToken ? (
                          <a className="as-btn as-btn-secondary" href={customerPageUrl(`/c/${li.certificateToken}`)} style={{ width: "auto" }}>
                            Certificate
                          </a>
                        ) : (
                          <a className="as-btn" href={registerHref(li, o.orderNumber)} style={{ width: "auto" }}>
                            Register
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          <section className="as-stack">
            <div className="as-section-head">
              <h2>Active warranties</h2>
            </div>
            {warranties!.length === 0 ? (
              <div className="as-empty">
                <strong>No warranties on file yet</strong>
                <p className="as-muted">Register a product from your orders above.</p>
              </div>
            ) : (
              warranties!.map((w) => (
                <article className="as-card" key={w.id}>
                  <div className="as-warranty-row">
                    <h3 className="as-warranty-title" style={{ fontSize: "1rem" }}>
                      {w.productTitle}
                    </h3>
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
                    {w.ruleName ? <span>{w.ruleName}</span> : null}
                  </div>
                  <div className="as-actions" style={{ marginTop: 8 }}>
                    <a className="as-btn as-btn-secondary" href={customerPageUrl(`/c/${w.certificateToken}`)}>
                      View certificate
                    </a>
                    <a
                      className="as-btn as-btn-ghost"
                      href={customerPageUrl("/apps/aftersale/claim", shop, {
                        certificate: w.certificateToken,
                      })}
                    >
                      Start a claim
                    </a>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      ) : (
        <form onSubmit={requestLink}>
          <p className="as-muted" style={{ marginTop: 0 }}>
            Enter the email and order number from your purchase. We’ll open your portal right away when
            they match — and email a secure link when mail is configured.
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
            {loading ? "Opening…" : "Open my warranties"}
          </button>
        </form>
      )}
    </CustomerShell>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="as-shell">
          <BrandLoader label="Opening your portal" />
        </div>
      }
    >
      <PortalInner />
    </Suspense>
  );
}
