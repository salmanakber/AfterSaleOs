"use client";

import { FormEvent, useState } from "react";
import { publicApiUrl } from "@/lib/public-api";
import type { CachedOrder, CachedWarranty } from "@/lib/customer-order-session";
import { ProductSearchSelect, type PickedProduct } from "./ProductSearchSelect";
import {
  COUNTRY_DIALS,
  detectCountryIso,
  formatE164,
  PhoneCountryField,
} from "./PhoneCountryField";
import { type FeePaymentInfo } from "@/lib/warranty-fee";
import { GoogleContinueButton, isGoogleSignInConfigured } from "./GoogleContinueButton";

type SourceMode = "catalog" | "orders" | null;

export type GuestRegisterSession = {
  email: string;
  orders: CachedOrder[];
  warranties: CachedWarranty[];
};

export function GuestRegisterFlow({
  shop,
  shopName,
  shopifyLoginUrl,
  onRegistered,
  onNeedSignIn,
  onGoogleSession,
}: {
  shop: string;
  shopName?: string;
  shopifyLoginUrl?: string;
  onRegistered: (session: GuestRegisterSession, fee?: FeePaymentInfo | null) => void;
  onNeedSignIn: () => void;
  onGoogleSession?: (session: GuestRegisterSession) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [source, setSource] = useState<SourceMode>(null);
  const [picked, setPicked] = useState<PickedProduct | null>(null);
  const [orders, setOrders] = useState<CachedOrder[]>([]);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupOrder, setLookupOrder] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serial, setSerial] = useState("");
  const [countryIso, setCountryIso] = useState(detectCountryIso);
  const [phoneNational, setPhoneNational] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookupOrders(e: FormEvent) {
    e.preventDefault();
    setLookupBusy(true);
    setLookupErr(null);
    try {
      const res = await fetch(
        publicApiUrl(`/api/public/guest-link?shop=${encodeURIComponent(shop)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop,
            email: lookupEmail,
            orderNumber: lookupOrder,
          }),
        },
      );
      const json = await res.json();
      if (json.portal?.orders?.length) {
        setOrders(json.portal.orders);
        setEmail(json.portal.email || lookupEmail);
        setLookupErr(null);
      } else {
        // Fallback: customer-session by email only
        const s = await fetch(publicApiUrl("/api/public/customer-session"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shop, email: lookupEmail }),
        });
        const sj = await s.json();
        if (s.ok && sj.orders?.length) {
          setOrders(sj.orders);
          setEmail(sj.email || lookupEmail);
        } else {
          setLookupErr(
            json.message ||
              "No matching order found. Check your email and order number, or pick from the store catalog.",
          );
        }
      }
    } catch (err) {
      setLookupErr(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookupBusy(false);
    }
  }

  function continueToDetails() {
    if (!picked?.title) {
      setError("Choose a product first.");
      return;
    }
    setError(null);
    if (lookupEmail && !email) setEmail(lookupEmail);
    setStep(2);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!picked?.title) throw new Error("Choose a product first.");
      if (!email.trim()) throw new Error("Email is required.");
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");

      const dial = COUNTRY_DIALS.find((c) => c.iso === countryIso)?.dial ?? "+1";
      const phone = formatE164(dial, phoneNational);

      const res = await fetch(publicApiUrl(`/api/public/register?shop=${encodeURIComponent(shop)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: phone || undefined,
          phoneCountry: countryIso,
          serialNumber: serial || undefined,
          orderNumber: picked.orderNumber || lookupOrder || undefined,
          productTitle: picked.title,
          shopifyProductId: picked.shopifyProductId,
          shopifyVariantId: picked.shopifyVariantId,
          outsideShopify: picked.source === "catalog" && !picked.orderNumber,
          createPortalAccount: true,
          source: "portal_guest",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Registration failed");
      const fee: FeePaymentInfo | null =
        json.paymentRequired && json.feeCheckoutUrl
          ? {
              checkoutUrl: json.feeCheckoutUrl as string,
              label: (json.feeLabel as string) || "Warranty registration",
              cents: typeof json.feeCents === "number" ? json.feeCents : null,
              currency: (json.currency as string) || "USD",
              registrationId: (json.registrationId as string) || "",
            }
          : null;
      onRegistered(
        {
          email: json.session?.email || email,
          orders: json.session?.orders ?? [],
          warranties: json.session?.warranties ?? [],
        },
        fee,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  const showSocial = Boolean(shopifyLoginUrl) || isGoogleSignInConfigured();

  return (
    <div className="as-guest-reg">
      <header className="as-guest-reg__head">
        <p className="as-guest-reg__kicker">Client portal</p>
        <h3>Activate your warranty{shopName ? ` with ${shopName}` : ""}</h3>
        <p className="as-muted">
          Register a product, or sign in with Google / Shopify — no store account required for email
          signup.
        </p>
        <ol className="as-guest-reg__steps" aria-label="Progress">
          <li data-active={step === 1} data-done={step > 1}>
            1 · Product
          </li>
          <li data-active={step === 2}>2 · Your details</li>
        </ol>
      </header>

      {step === 1 && !source && showSocial ? (
        <div className="as-guest-reg__social">
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
          {isGoogleSignInConfigured() && onGoogleSession ? (
            <GoogleContinueButton
              shop={shop}
              onSuccess={(s) =>
                onGoogleSession({
                  email: s.email,
                  orders: (s.orders as CachedOrder[]) ?? [],
                  warranties: (s.warranties as CachedWarranty[]) ?? [],
                })
              }
              onError={setError}
              onBusy={setBusy}
            />
          ) : null}
          <p className="as-portal-login__or">or register a product</p>
        </div>
      ) : null}

      {error && step === 1 && !source ? (
        <div className="as-alert as-alert-error">{error}</div>
      ) : null}

      {step === 1 ? (
        <div className="as-guest-reg__body">
          {!source ? (
            <div className="as-guest-reg__sources">
              <button
                type="button"
                className="as-guest-reg__source"
                onClick={() => setSource("catalog")}
              >
                <span className="as-guest-reg__source-icon" aria-hidden>
                  ⌕
                </span>
                <strong>From the store</strong>
                <span>Search products in the catalog</span>
              </button>
              <button
                type="button"
                className="as-guest-reg__source"
                onClick={() => setSource("orders")}
              >
                <span className="as-guest-reg__source-icon" aria-hidden>
                  #
                </span>
                <strong>From my orders</strong>
                <span>Look up a purchase, then pick the item</span>
              </button>
            </div>
          ) : null}

          {source === "orders" ? (
            <div className="as-guest-reg__lookup">
              <button
                type="button"
                className="as-guest-reg__back"
                onClick={() => {
                  setSource(null);
                  setPicked(null);
                  setOrders([]);
                }}
              >
                ← Change source
              </button>
              {orders.length === 0 ? (
                <form className="as-dash-form" onSubmit={lookupOrders}>
                  <p className="as-muted">
                    Enter the email and order number from your purchase to load items.
                  </p>
                  <div>
                    <label className="as-label">Email on the order</label>
                    <input
                      className="as-input"
                      type="email"
                      required
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="as-label">Order number</label>
                    <input
                      className="as-input"
                      required
                      value={lookupOrder}
                      onChange={(e) => setLookupOrder(e.target.value)}
                      placeholder="#1001"
                    />
                  </div>
                  {lookupErr ? <div className="as-alert as-alert-error">{lookupErr}</div> : null}
                  <button className="as-btn" type="submit" disabled={lookupBusy || !shop}>
                    {lookupBusy ? "Looking up…" : "Find my order"}
                  </button>
                </form>
              ) : (
                <>
                  <ProductSearchSelect
                    shop={shop}
                    orders={orders}
                    mode="orders"
                    value={picked}
                    onChange={setPicked}
                    placeholder="Pick a product from your order…"
                  />
                  {error ? <div className="as-alert as-alert-error">{error}</div> : null}
                  <button
                    type="button"
                    className="as-btn"
                    disabled={!picked}
                    onClick={continueToDetails}
                  >
                    Continue
                  </button>
                </>
              )}
            </div>
          ) : null}

          {source === "catalog" ? (
            <div className="as-guest-reg__lookup">
              <button
                type="button"
                className="as-guest-reg__back"
                onClick={() => {
                  setSource(null);
                  setPicked(null);
                }}
              >
                ← Change source
              </button>
              <ProductSearchSelect
                shop={shop}
                mode="catalog"
                value={picked}
                onChange={setPicked}
                placeholder="Search the store catalog…"
              />
              {error ? <div className="as-alert as-alert-error">{error}</div> : null}
              <button
                type="button"
                className="as-btn"
                disabled={!picked}
                onClick={continueToDetails}
              >
                Continue
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <form className="as-guest-reg__body as-dash-form" onSubmit={submit}>
          <button type="button" className="as-guest-reg__back" onClick={() => setStep(1)}>
            ← Back to product
          </button>
          <div className="as-guest-reg__picked">
            <span>Registering</span>
            <strong>{picked?.title}</strong>
            {picked?.orderNumber ? <em>Order {picked.orderNumber}</em> : null}
          </div>
          <div className="as-field-grid">
            <div>
              <label className="as-label">First name</label>
              <input
                className="as-input"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="as-label">Last name</label>
              <input
                className="as-input"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div className="as-field-span">
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
            <div className="as-field-span">
              <PhoneCountryField
                countryIso={countryIso}
                nationalNumber={phoneNational}
                onCountryChange={setCountryIso}
                onNationalChange={setPhoneNational}
                required
              />
            </div>
            <div className="as-field-span">
              <label className="as-label">Create password</label>
              <input
                className="as-input"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
              <p className="as-guest-reg__hint">
                This is your portal login (no Shopify account required). You’ll stay signed in after
                registration.
              </p>
            </div>
            <div className="as-field-span">
              <label className="as-label">Serial (optional)</label>
              <input className="as-input" value={serial} onChange={(e) => setSerial(e.target.value)} />
            </div>
          </div>
          {error ? <div className="as-alert as-alert-error">{error}</div> : null}
          <button className="as-btn" type="submit" disabled={busy || !shop}>
            {busy ? "Registering…" : "Register & continue"}
          </button>
          <p className="as-guest-reg__hint">
            If this store charges a warranty fee, you’ll pay it on Shopify checkout next — then your
            coverage activates automatically.
          </p>
        </form>
      )}

      <p className="as-guest-reg__signin">
        Already have a portal account?{" "}
        <button type="button" className="as-linkish" onClick={onNeedSignIn}>
          Sign in
        </button>
      </p>
    </div>
  );
}
