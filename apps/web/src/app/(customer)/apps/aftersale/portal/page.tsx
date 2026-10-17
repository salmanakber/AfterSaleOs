"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
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
import { GuestRegisterFlow } from "../../../components/GuestRegisterFlow";
import {
  GoogleContinueButton,
  isGoogleSignInConfigured,
} from "../../../components/GoogleContinueButton";
import type { FeePaymentInfo } from "@/lib/warranty-fee";

type AuthMode = "signin" | "signup";
type Gate = "register" | "auth";

/**
 * Build a Shopify customer login URL that avoids the common
 * `/account/login` ↔ redirect loop on New Customer Accounts, and always
 * breaks out of iframes via target=_top on the link.
 */
function buildShopifyLoginUrl(opts: {
  shop: string;
  embed: boolean;
  /** Liquid `routes.account_login_url` when passed from the theme embed */
  loginBase?: string | null;
  /** Storefront path/URL to return to after login (embed page) */
  returnTo?: string | null;
}) {
  const { shop, embed, loginBase, returnTo } = opts;
  if (!shop) return "";

  // Prefer returning to the storefront page (embed reloads with customer.id).
  // Hosted / app-proxy: land on the proxied portal so Shopify injects logged_in_customer_id.
  const fallbackReturn = embed
    ? "/"
    : `https://${shop}/apps/aftersale/portal?shop=${encodeURIComponent(shop)}&from_shopify=1`;
  const destination = (returnTo && returnTo.trim()) || fallbackReturn;
  const destEncoded = encodeURIComponent(destination);

  const baseRaw = (loginBase && loginBase.trim()) || "";
  if (baseRaw) {
    const base = baseRaw.startsWith("http")
      ? baseRaw
      : baseRaw.startsWith("/")
        ? `https://${shop}${baseRaw}`
        : `https://${shop}/${baseRaw}`;
    const join = base.includes("?") ? "&" : "?";
    // New Customer Accounts use return_to; classic login uses return_url.
    if (
      base.includes("customer_authentication") ||
      base.includes("shopify.com/authentication") ||
      base.includes("account.shopify.com")
    ) {
      return `${base}${join}return_to=${destEncoded}`;
    }
    return `${base}${join}return_url=${destEncoded}`;
  }

  // Default: New Customer Accounts endpoint (avoids /account/login redirect loops).
  return `https://${shop}/customer_authentication/login?return_to=${destEncoded}`;
}

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
  const shopifyLoginBase = params.get("shopify_login");
  const storefrontReturn = params.get("return_to");
  const fromShopify = params.get("from_shopify") === "1";

  const session = useCustomerOrderSession({
    shop: token ? "" : shop,
    emailFromUrl: prefillEmail,
    loggedInCustomerId,
  });

  const [gate, setGate] = useState<Gate>(() => {
    if (loggedInCustomerId || fromShopify || prefillEmail) return "auth";
    if (viewParam === "claim" || viewParam === "requests" || viewParam === "products") return "auth";
    return "register";
  });
  const [entryView, setEntryView] = useState<PortalView>(
    viewParam === "activate" ? "activate" : viewParam || "home",
  );
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [warranties, setWarranties] = useState<CachedWarranty[]>([]);
  const [orders, setOrders] = useState<CachedOrder[]>([]);
  const [shopName, setShopName] = useState<string>("");
  const [pendingFeePayment, setPendingFeePayment] = useState<FeePaymentInfo | null>(null);

  const shopifyLoginUrl = useMemo(
    () =>
      buildShopifyLoginUrl({
        shop,
        embed,
        loginBase: shopifyLoginBase,
        returnTo: storefrontReturn,
      }),
    [shop, embed, shopifyLoginBase, storefrontReturn],
  );

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
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open portal");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, shop]);

  function applySession(nextEmail: string, nextOrders: CachedOrder[], nextWarranties: CachedWarranty[]) {
    setSessionEmail(nextEmail);
    setEmail(nextEmail);
    setOrders(nextOrders);
    setWarranties(nextWarranties);
    persistPortalSession({
      shop,
      email: nextEmail,
      orders: nextOrders,
      warranties: nextWarranties,
    });
    setMessage(null);
    setError(null);
    setPassword("");
  }

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      if (!shop) {
        setError("Open this portal from your store’s warranty link.");
        setLoading(false);
        return;
      }
      const path =
        mode === "signup"
          ? "/api/public/customer-auth/register"
          : "/api/public/customer-auth/login";
      const res = await fetch(publicApiUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          email,
          password,
          ...(mode === "signup" && name.trim() ? { name: name.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Authentication failed");
      applySession(json.email, json.orders ?? [], json.warranties ?? []);
      if (mode === "signup") {
        setMessage("Account created — you’re in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
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
    setError(null);
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
          initialView={entryView}
          pendingFeePayment={pendingFeePayment}
          onDismissFeePayment={() => setPendingFeePayment(null)}
          onLogout={logout}
          onSessionRefresh={() => void refreshSession()}
        />
      </CustomerShell>
    );
  }

  if (gate === "register") {
    return (
      <CustomerShell
        title="Register product"
        lede="Activate warranty and open your portal"
        {...shellProps}
        brand={shopName || "AfterSale"}
        chrome="dashboard"
      >
        <GuestRegisterFlow
          shop={shop}
          shopName={shopName}
          shopifyLoginUrl={shopifyLoginUrl || undefined}
          onRegistered={(session, fee) => {
            setEntryView("products");
            if (fee) setPendingFeePayment(fee);
            applySession(session.email, session.orders, session.warranties);
          }}
          onGoogleSession={(session) => {
            setEntryView("home");
            applySession(session.email, session.orders, session.warranties);
          }}
          onNeedSignIn={() => setGate("auth")}
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
            Sign in with email and password (no Shopify account required), or continue with Shopify.
          </p>

          <button type="button" className="as-portal-login__back" onClick={() => setGate("register")}>
            ← Register a product instead
          </button>

          <div className="as-portal-login__providers">
            {shopifyLoginUrl ? (
              <a
                className="as-portal-login__shopify"
                href={shopifyLoginUrl}
                target="_top"
                rel="noopener noreferrer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
                  <path
                    d="M7.5 8.5V7a4.5 4.5 0 0 1 9 0v1.5M6 8.5h12l-.7 11.2a2 2 0 0 1-2 1.8H8.7a2 2 0 0 1-2-1.8L6 8.5Z"
                    stroke="#95BF47"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Continue with Shopify
              </a>
            ) : null}

            {isGoogleSignInConfigured() ? (
              <GoogleContinueButton
                shop={shop}
                onSuccess={(s) =>
                  applySession(
                    s.email,
                    (s.orders as CachedOrder[]) ?? [],
                    (s.warranties as CachedWarranty[]) ?? [],
                  )
                }
                onError={setError}
                onBusy={setLoading}
              />
            ) : null}
          </div>

          <p className="as-portal-login__or">or use email</p>

          <div className="as-portal-login__modes" role="tablist">
            <button
              type="button"
              role="tab"
              data-active={mode === "signin"}
              onClick={() => {
                setMode("signin");
                setError(null);
                setMessage(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              data-active={mode === "signup"}
              onClick={() => {
                setMode("signup");
                setError(null);
                setMessage(null);
              }}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submitAuth} className="as-dash-form">
            {mode === "signup" ? (
              <div>
                <label className="as-label">Name</label>
                <input
                  className="as-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Optional"
                />
              </div>
            ) : null}
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
              <label className="as-label">Password</label>
              <input
                className="as-input"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder={mode === "signup" ? "At least 8 characters" : undefined}
              />
            </div>
            {error ? <div className="as-alert as-alert-error">{error}</div> : null}
            {message ? <div className="as-alert as-alert-ok">{message}</div> : null}
            <button className="as-btn" type="submit" disabled={loading || !shop}>
              {loading
                ? mode === "signup"
                  ? "Creating…"
                  : "Signing in…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="as-portal-login__hint as-muted">
            Shopify login opens on the store (full page). Email + password works without a Shopify
            account if you prefer.
          </p>
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
