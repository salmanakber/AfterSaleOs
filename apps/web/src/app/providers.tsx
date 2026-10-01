"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to bootstrap");
        setReady(true);
      }
    }

    void bootstrap();
  }, []);

  const value = useMemo(() => ({ shop, getSessionToken, clearSessionTokenCache }), [shop]);

  if (!ready) {
    return (
      <AppProvider i18n={enTranslations}>
        <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
          <Spinner accessibilityLabel="Loading AfterSale OS" size="large" />
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
          {children}
        </Frame>
      </MerchantAuthContext.Provider>
    </AppProvider>
  );
}
