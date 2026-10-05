"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AppProvider, Banner, Frame } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { getSessionToken, clearSessionTokenCache, merchantAuthHeaders } from "@/lib/session-token";
import { rememberShopParams, getRememberedShop, appHref } from "@/lib/shop-context";
import { AppNav } from "./components/AppNav";
import { BrandLoader } from "./components/BrandLoader";
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
  /** Client-side navigate — keeps sidebar mounted. */
  navigate: (path: string) => void;
  isNavigating: boolean;
};

const MerchantAuthContext = createContext<MerchantAuth>({
  shop: null,
  getSessionToken: async () => null,
  clearSessionTokenCache: () => undefined,
  appHref: (p) => p,
  navigate: () => undefined,
  isNavigating: false,
});

export function useMerchantAuth() {
  return useContext(MerchantAuthContext);
}

function isModifiedClick(e: MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

function shouldInterceptLink(a: HTMLAnchorElement): string | null {
  if (a.target && a.target !== "_self") return null;
  if (a.hasAttribute("download")) return null;
  if (a.getAttribute("rel")?.includes("external")) return null;
  // Shopify admin NavMenu owns these links.
  if (a.closest(".as-m-navmenu-host")) return null;

  const href = a.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return null;
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }
  return href;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<string | null>(null);
  const [isNavigating, startTransition] = useTransition();
  const bootstrapped = useRef(false);

  const navigate = useCallback(
    (path: string) => {
      const href = path.startsWith("/") || path.startsWith("http") ? appHref(path) : appHref(`/${path}`);
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  // Bootstrap once — never again on every route change.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

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
          const onPlans = window.location.pathname.startsWith("/plans");

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
  }, [router]);

  // Turn in-app <a> / Polaris url= clicks into client navigations (sidebar stays mounted).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || isModifiedClick(e)) return;
      const target = e.target as Element | null;
      const a = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = shouldInterceptLink(a);
      if (!href) return;

      e.preventDefault();
      startTransition(() => {
        router.push(href);
      });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);

  const value = useMemo(
    () => ({
      shop,
      getSessionToken,
      clearSessionTokenCache,
      appHref,
      navigate,
      isNavigating,
    }),
    [shop, navigate, isNavigating],
  );

  if (!ready) {
    return (
      <AppProvider i18n={enTranslations}>
        <div className="as-m-boot">
          <BrandLoader label="Starting AfterSale OS" />
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
              <div className={`as-m-main${isNavigating ? " is-navigating" : ""}`}>
                {isNavigating ? (
                  <div className="as-m-nav-progress" aria-hidden>
                    <span />
                  </div>
                ) : null}
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
