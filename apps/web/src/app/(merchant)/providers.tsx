"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppProvider, Banner, Frame, Spinner } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { getSessionToken, clearSessionTokenCache } from "@/lib/session-token";
import { AppNav } from "./components/AppNav";

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
      toast?: { show: (msg: string) => void };
    };
  }
}

type MerchantAuth = {
  shop: string | null;
  getSessionToken: () => Promise<string | null>;
  clearSessionTokenCache: () => void;
};

const MerchantAuthContext = createContext<MerchantAuth>({
  shop: null,
  getSessionToken: async () => null,
  clearSessionTokenCache: () => undefined,
});

export function useMerchantAuth() {
  return useContext(MerchantAuthContext);
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get("shop");
    setShop(shopParam);

    async function bootstrap() {
      if (!shopParam) {
        setReady(true);
        return;
      }

      try {
        const sessionRes = await fetch(`/api/auth/session?shop=${encodeURIComponent(shopParam)}`);
        const sessionJson = await sessionRes.json();
        if (sessionJson.needsAuth) {
          window.open(`/api/auth?shop=${encodeURIComponent(shopParam)}`, "_top");
          return;
        }
        if (typeof window.shopify?.idToken === "function") {
          await getSessionToken();
        }

        // First install / re-install: force plan selection before dashboard.
        // After Shopify billing approval (?billing=return), land on plans then home once active.
        const token = await getSessionToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        headers["x-aftersale-shop"] = shopParam;
        const billingReturn = params.get("billing") === "return";
        const billingUrl = billingReturn ? "/api/billing?sync=1" : "/api/billing";
        const billingRes = await fetch(billingUrl, { headers });
        if (billingRes.ok) {
          const billing = (await billingRes.json()) as {
            needsPlanSelection?: boolean;
            billingStatus?: string;
            current?: { slug?: string } | null;
          };
          const onPlans = pathname?.startsWith("/plans");

          if (billingReturn) {
            if (billing.current?.slug || billing.billingStatus === "ACTIVE") {
              router.replace(`/?shop=${encodeURIComponent(shopParam)}`);
              setReady(true);
              return;
            }
            router.replace(`/plans?welcome=1&shop=${encodeURIComponent(shopParam)}&billing=return`);
            setReady(true);
            return;
          }

          if (billing.needsPlanSelection && !onPlans) {
            router.replace(`/plans?welcome=1&shop=${encodeURIComponent(shopParam)}`);
            setReady(true);
            return;
          }
        }

        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to bootstrap");
        setReady(true);
      }
    }

    void bootstrap();
  }, [pathname, router]);

  const value = useMemo(() => ({ shop, getSessionToken, clearSessionTokenCache }), [shop]);

  if (!ready) {
    return (
      <AppProvider i18n={enTranslations}>
        <div
          style={{
            display: "grid",
            placeItems: "center",
            minHeight: "100vh",
            gap: 16,
            background:
              "radial-gradient(700px 320px at 20% 0%, rgba(99,102,241,.18), transparent 55%), #f4f6fb",
          }}
        >
          <Spinner accessibilityLabel="Loading AfterSale OS" size="large" />
          <p style={{ margin: 0, color: "#64748b", fontWeight: 600, letterSpacing: "0.04em" }}>
            Loading AfterSale OS…
          </p>
        </div>
      </AppProvider>
    );
  }

  return (
    <AppProvider i18n={enTranslations}>
      <MerchantAuthContext.Provider value={value}>
        <Frame>
          <AppNav />
          {error ? (
            <div style={{ padding: 16 }}>
              <Banner tone="critical" title="Connection error">
                <p>{error}</p>
              </Banner>
            </div>
          ) : null}
          <div className="as-m-page">{children}</div>
        </Frame>
      </MerchantAuthContext.Provider>
    </AppProvider>
  );
}
