"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { publicApiUrl } from "@/lib/public-api";
import { type CachedOrder, type CachedWarranty } from "@/lib/customer-order-session";
import { useCustomerOrderSession } from "@/lib/use-customer-order-session";
import { parseEmbedLayout } from "@/lib/embed-layout";
import { BrandLoader } from "../../../components/BrandLoader";
import { CustomerShell } from "../../../components/CustomerShell";
import {
  ClientPortal,
  clearPortalSession,
  persistPortalSession,
  type PortalView,
} from "../../../components/ClientPortal";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

function PortalInner() {
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const token = params.get("token");
  const embed = params.get("embed") === "1";
  const themeLocal = params.get("theme") === "local" || embed;
  const accentOverride = params.get("accent");
  const embedLayout = parseEmbedLayout(params);
  const prefillEmail = params.get("email") ?? "";
  const viewParam = (params.get("view") as PortalView | null) || "home";
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
  const [googleReady, setGoogleReady] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [warranties, setWarranties] = useState<CachedWarranty[]>([]);
  const [orders, setOrders] = useState<CachedOrder[]>([]);
  const [shopName, setShopName] = useState<string>("");

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  useEffect(() => {
    if (!shop) return;
    fetch(publicApiUrl(`/api/public/branding?shop=${encodeURIComponent(shop)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.shopName) setShopName(j.shopName);
      })
      .catch(() => undefined);
  }, [shop]);

  useEffect(() => {
    if (token) return;
    if (!session.sessionReady || !session.hydrated) return;
    if (session.email) {
      setSessionEmail(session.email);
      setEmail(session.email);
      setWarranties(session.warranties);
      setOrders(session.orders);
    }
  }, [
    token,
    session.sessionReady,
    session.hydrated,
    session.email,
    session.orders,
    session.warranties,
  ]);

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
        setOrders(json.orders ?? []);
        if (json.email) {
          persistPortalSession({
            shop,
            email: json.email,
            orders: json.orders ?? [],
            warranties: json.warranties ?? [],
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

  // Optional Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || sessionEmail) return;
    const existing = document.getElementById("as-google-gsi");
    if (existing) {
      setGoogleReady(true);
      return;
    }
    const s = document.createElement("script");
    s.id = "as-google-gsi";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => setGoogleReady(true);
    document.head.appendChild(s);
  }, [sessionEmail]);

  useEffect(() => {
    if (!googleReady || !GOOGLE_CLIENT_ID || sessionEmail) return;
    const g = (window as unknown as { google?: { accounts: { id: {
      initialize: (c: unknown) => void;
      renderButton: (el: HTMLElement, c: unknown) => void;
    } } } }).google;
    if (!g?.accounts?.id) return;
    const el = document.getElementById("as-google-btn");
    if (!el) return;
    g.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp: { credential?: string }) => {
        if (!resp.credential || !shop) return;
        setLoading(true);
        setMessage(null);
        try {
          const res = await fetch(publicApiUrl("/api/public/customer-auth/google"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shop, credential: resp.credential }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Google sign-in failed");
          setSessionEmail(json.email);
          setEmail(json.email);
          setOrders(json.orders ?? []);
          setWarranties(json.warranties ?? []);
          persistPortalSession({
            shop,
            email: json.email,
            orders: json.orders ?? [],
            warranties: json.warranties ?? [],
          });
        } catch (err) {
          setMessage(err instanceof Error ? err.message : "Google sign-in failed");
        } finally {
          setLoading(false);
        }
      },
    });
    el.innerHTML = "";
    g.accounts.id.renderButton(el, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 320,
    });
  }, [googleReady, sessionEmail, shop]);

  async function requestLink(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (!shop) {
        setMessage("Open this portal from your store’s warranty link.");
        setLoading(false);
        return;
      }
      const res = await fetch(
        publicApiUrl(`/api/public/guest-link?shop=${encodeURIComponent(shop)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, orderNumber, shop }),
        },
      );
      const json = await res.json();
      if (json.portal?.orders || json.portal?.warranties) {
        setSessionEmail(json.portal.email);
        setWarranties(json.portal.warranties ?? []);
        setOrders(json.portal.orders ?? []);
        if (json.portal.email) {
          persistPortalSession({
            shop,
            email: json.portal.email,
            orders: json.portal.orders ?? [],
            warranties: json.portal.warranties ?? [],
          });
        }
        setMessage(json.emailHint ?? "You’re in.");
      } else {
        setMessage(json.message ?? "If we find a match, we’ll email a sign-in link.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not verify");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSession() {
    if (!shop || !sessionEmail) return;
    try {
      const res = await fetch(publicApiUrl("/api/public/customer-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, email: sessionEmail }),
      });
      const json = await res.json();
      if (!res.ok) return;
      setOrders(json.orders ?? []);
      setWarranties(json.warranties ?? []);
      persistPortalSession({
        shop,
        email: sessionEmail,
        orders: json.orders ?? [],
        warranties: json.warranties ?? [],
      });
    } catch {
      /* ignore */
    }
  }

  function logout() {
    clearPortalSession(shop);
    setSessionEmail(null);
    setOrders([]);
    setWarranties([]);
    setMessage(null);
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

  if (sessionEmail) {
    return (
      <CustomerShell
        title="Client portal"
        lede="Your warranties and claims"
        {...shellProps}
        brand={shopName || "AfterSale"}
        chrome="dashboard"
      >
        <ClientPortal
          shop={shop}
          shopName={shopName}
          email={sessionEmail}
          orders={orders}
          warranties={warranties}
          embed={embed}
          initialView={viewParam}
          onLogout={logout}
          onSessionRefresh={() => void refreshSession()}
        />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell
      title="Sign in"
      lede="Access warranties, registration, and claims in one place."
      {...shellProps}
      brand={shopName || "AfterSale"}
      chrome="dashboard"
    >
      <div className="as-portal-login">
        <div className="as-portal-login__card">
          <p className="as-portal-login__kicker">Client portal</p>
          <h3>Welcome{shopName ? ` to ${shopName}` : ""}</h3>
          <p className="as-muted">
            Sign in with Google or verify with the email and order number from your purchase.
          </p>

          {GOOGLE_CLIENT_ID ? (
            <div className="as-portal-login__google">
              <div id="as-google-btn" />
              <p className="as-portal-login__or">or continue with email</p>
            </div>
          ) : null}

          <form onSubmit={requestLink} className="as-dash-form">
            <div>
              <label className="as-label">Email</label>
              <input
                className="as-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="as-label">Order number</label>
              <input
                className="as-input"
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="#1001"
              />
            </div>
            {message ? <div className="as-alert as-alert-ok">{message}</div> : null}
            <button className="as-btn" type="submit" disabled={loading || !shop}>
              {loading ? "Checking…" : "Sign in to portal"}
            </button>
          </form>

          {!GOOGLE_CLIENT_ID ? (
            <p className="as-portal-login__hint as-muted">
              Google sign-in appears here when the app has a Google client ID configured.
            </p>
          ) : null}
        </div>
      </div>
    </CustomerShell>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="as-shell">
          <BrandLoader label="Opening portal" />
        </div>
      }
    >
      <PortalInner />
    </Suspense>
  );
}
