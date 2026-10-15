"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { customerPageUrl, publicApiUrl } from "@/lib/public-api";
import {
  saveCustomerOrderSession,
  type CachedOrder,
  type CachedWarranty,
} from "@/lib/customer-order-session";
import { useCustomerOrderSession } from "@/lib/use-customer-order-session";
import { parseEmbedLayout } from "@/lib/embed-layout";
import { BrandLoader } from "../../../components/BrandLoader";
import { CustomerShell } from "../../../components/CustomerShell";

type WarrantyRow = CachedWarranty;
type OrderRow = CachedOrder;

function PortalInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const token = params.get("token");
  const embed = params.get("embed") === "1";
  const themeLocal = params.get("theme") === "local" || embed;
  const accentOverride = params.get("accent");
  const embedLayout = parseEmbedLayout(params);
  const prefillEmail = params.get("email") ?? "";
  const loggedInCustomerId =
    params.get("logged_in_customer_id") ?? params.get("customer_id") ?? "";

  const session = useCustomerOrderSession({
    shop: token ? "" : shop,
    emailFromUrl: prefillEmail,
    loggedInCustomerId,
  });

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

  // Auto-open from Shopify login / cached session / email lookup
  useEffect(() => {
    if (token) return;
    if (!session.sessionReady || !session.hydrated) return;
    setSessionEmail(session.email || null);
    setEmail(session.email || email);
    setWarranties(session.warranties);
    setOrders(session.orders);
  }, [token, session.sessionReady, session.hydrated, session.email, session.orders, session.warranties, email]);

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
        if (json.email) {
          saveCustomerOrderSession({
            shop,
            email: json.email,
            orders: json.orders ?? [],
            warranties: json.warranties ?? [],
            source: "portal_token",
          });
        }
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

  async function requestLink(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (!shop) {
        setMessage("Open this warranty portal from your store’s warranty link to continue.");
        setLoading(false);
        return;
      }
      const res = await fetch(publicApiUrl(`/api/public/guest-link?shop=${encodeURIComponent(shop)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orderNumber, shop }),
      });
      const json = await res.json();
      if (json.portal?.orders || json.portal?.warranties) {
        setSessionEmail(json.portal.email);
        setWarranties(json.portal.warranties ?? []);
        setOrders(json.portal.orders ?? []);
        if (json.portal.email) {
          saveCustomerOrderSession({
            shop,
            email: json.portal.email,
            orders: json.portal.orders ?? [],
            warranties: json.portal.warranties ?? [],
            source: "guest_verify",
          });
        }
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

  const open = warranties !== null;

  // Only block the whole page for magic-link token exchange — never for session lookup.
  if (loading && token && !open) {
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
      embedCols={embedLayout.cols}
      embedWidth={embedLayout.width}
      embedStyle={embedLayout.style}
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
            Enter the email and order number from your purchase once. We’ll open your orders here and
            remember them in this browser for register / claim. Tip: open this page from your store
            while logged in, or use a link that includes your email.
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
