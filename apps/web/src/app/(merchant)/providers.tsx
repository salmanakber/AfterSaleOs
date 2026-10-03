"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppProvider, Banner, Frame, Spinner } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { getSessionToken, clearSessionTokenCache, merchantAuthHeaders } from "@/lib/session-token";
import { rememberShopParams, getRememberedShop, appHref } from "@/lib/shop-context";
import { AppNav } from "./components/AppNav";
import { TourProvider } from "./components/ProductTour";

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
  appHref: (path: string) => string;
};

const MerchantAuthContext = createContext<MerchantAuth>({
  shop: null,
  getSessionToken: async () => null,
  clearSessionTokenCache: () => undefined,
  appHref: (p) => p,
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
    const shopParam = params.get("shop") ?? getRememberedShop();
    const hostParam = params.get("host");
    if (shopParam) rememberShopParams(shopParam, hostParam);
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

        // Ensure App Bridge token is warm before first GraphQL calls.
        await getSessionToken();

        const headers = await merchantAuthHeaders();
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
              router.replace(appHref("/"));
              setReady(true);
              return;
            }
            router.replace(appHref("/plans?welcome=1&billing=return"));
            setReady(true);
            return;
          }

          if (billing.needsPlanSelection && !onPlans) {
            router.replace(appHref("/plans?welcome=1"));
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

  const value = useMemo(
    () => ({ shop, getSessionToken, clearSessionTokenCache, appHref }),
    [shop],
  );

  if (!ready) {
    return (
      <AppProvider i18n={enTranslations}>
        <div className="as-m-boot">
          <Spinner accessibilityLabel="Loading AfterSale OS" size="large" />
        </div>
      </AppProvider>
    );
  }

  return (
    <AppProvider i18n={enTranslations}>
      <MerchantAuthContext.Provider value={value}>
        <TourProvider>
          <Frame>
            <div className="as-m-shell">
              <AppNav />
              <div className="as-m-main">
                {error ? (
                  <div style={{ padding: "12px 16px" }}>
                    <Banner tone="critical" title="Connection error">
                      <p>{error}</p>
                    </Banner>
                  </div>
                ) : null}
                <div className="as-m-page">{children}</div>
              </div>
            </div>
          </Frame>
        </TourProvider>
      </MerchantAuthContext.Provider>
    </AppProvider>
  );
}
