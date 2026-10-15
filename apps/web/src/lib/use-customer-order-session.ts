"use client";

import { useEffect, useState } from "react";
import { publicApiUrl } from "@/lib/public-api";
import {
  loadCustomerOrderSession,
  saveCustomerOrderSession,
  type CachedOrder,
  type CachedWarranty,
} from "@/lib/customer-order-session";

type Options = {
  shop: string;
  emailFromUrl?: string;
  loggedInCustomerId?: string;
  orderFromUrl?: string;
};

/**
 * Restore or fetch customer orders for standalone register / claim / portal pages.
 * Sources (in order): URL email, Shopify logged_in_customer_id (app proxy), localStorage cache.
 */
export function useCustomerOrderSession(opts: Options) {
  const { shop, emailFromUrl = "", loggedInCustomerId = "", orderFromUrl = "" } = opts;
  const [email, setEmail] = useState(emailFromUrl);
  const [orders, setOrders] = useState<CachedOrder[]>([]);
  const [warranties, setWarranties] = useState<CachedWarranty[]>([]);
  const [sessionReady, setSessionReady] = useState(Boolean(emailFromUrl || loggedInCustomerId));
  const [orderNumber, setOrderNumber] = useState(orderFromUrl);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (emailFromUrl) setEmail(emailFromUrl);
    if (orderFromUrl) setOrderNumber(orderFromUrl);
  }, [emailFromUrl, orderFromUrl]);

  useEffect(() => {
    if (!shop) {
      setHydrated(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    async function run() {
      const cached = loadCustomerOrderSession(shop);
      if (cached && !cancelled) {
        if (!emailFromUrl) setEmail(cached.email);
        setOrders(cached.orders);
        setWarranties(cached.warranties);
        setSessionReady(true);
        if (!orderFromUrl && cached.orders[0]) setOrderNumber(cached.orders[0].orderNumber);
        // Show UI immediately from cache; refresh in background.
        setHydrated(true);
      }

      const customerId = loggedInCustomerId.replace(/\D/g, "");
      const email = (emailFromUrl || cached?.email || "").trim().toLowerCase();

      if (!customerId && !email) {
        if (!cancelled) {
          setLoading(false);
          setHydrated(true);
        }
        return;
      }

      if (!cancelled) setLoading(true);
      try {
        const res = await fetch(publicApiUrl("/api/public/customer-session"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop,
            email: email || undefined,
            loggedInCustomerId: customerId || undefined,
          }),
          signal: controller.signal,
        });
        const json = await res.json();
        if (!cancelled && res.ok && (json.orders || json.email)) {
          const nextEmail = (json.email as string) || email;
          const nextOrders = (json.orders ?? []) as CachedOrder[];
          const nextWarranties = (json.warranties ?? []) as CachedWarranty[];
          setEmail(nextEmail);
          setOrders(nextOrders);
          setWarranties(nextWarranties);
          setSessionReady(true);
          if (!orderFromUrl && nextOrders[0]) setOrderNumber(nextOrders[0].orderNumber);
          if (nextEmail) {
            saveCustomerOrderSession({
              shop,
              email: nextEmail,
              orders: nextOrders,
              warranties: nextWarranties,
              source: customerId ? "shopify_email" : "lookup",
            });
          }
        }
      } catch {
        /* keep cache / show verify form */
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) {
          setLoading(false);
          setHydrated(true);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [shop, emailFromUrl, loggedInCustomerId, orderFromUrl]);

  return {
    email,
    setEmail,
    orders,
    setOrders,
    warranties,
    setWarranties,
    sessionReady,
    setSessionReady,
    orderNumber,
    setOrderNumber,
    hydrated,
    loading,
  };
}
