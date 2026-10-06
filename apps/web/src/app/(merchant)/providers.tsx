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
import { useRouter, usePathname } from "next/navigation";
import { AppProvider, Banner, Frame } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { getSessionToken, clearSessionTokenCache, merchantAuthHeaders } from "@/lib/session-token";
import { rememberShopParams, getRememberedShop, getRememberedHost, appHref } from "@/lib/shop-context";
import { AppNav } from "./components/AppNav";
import { BrandLoader } from "./components/BrandLoader";
import { TourProvider } from "./components/ProductTour";

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

/** If we landed on standalone APP_URL (outside Admin iframe), bounce into embed. */
function redirectStandaloneIntoAdmin(shop: string | null, host: string | null): boolean {
  if (typeof window === "undefined") return false;
  if (!SHOPIFY_API_KEY || !shop) return false;
  try {
    if (window.top !== window.self) return false; // already embedded
  } catch {
    // cross-origin frame — treat as embedded
    return false;
  }
  if (window.location.hostname.includes("admin.shopify.com")) return false;

  const params = new URLSearchParams(window.location.search);
  const keep = new URLSearchParams();
  for (const [k, v] of params.entries()) {
    if (!["shop", "host", "hmac", "timestamp", "session", "embedded", "locale", "id_token"].includes(k)) {
      keep.set(k, v);
    }
  }
  const q = keep.toString();
  const path = `${window.location.pathname}${q ? `?${q}` : ""}`;

  let adminBase: string | null = null;
  if (host) {
    try {
      const decoded = atob(host.replace(/-/g, "+").replace(/_/g, "/"));
      if (/admin\.shopify\.com|myshopify\.com/i.test(decoded)) {
        adminBase = `https://${decoded.replace(/^https?:\/\//, "")}/apps/${SHOPIFY_API_KEY}`;
      }
    } catch {
      /* ignore */
    }
  }
  if (!adminBase) {
    const handle = shop.replace(/\.myshopify\.com$/i, "");
    adminBase = `https://admin.shopify.com/store/${handle}/apps/${SHOPIFY_API_KEY}`;
  }

  const target = `${adminBase}${path === "/" ? "" : path}`;
  window.location.replace(target);
  return true;
}

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
  /** True until the shop picks a plan (or billing is bypassed). */
  needsPlanSelection: boolean;
  refreshBillingGate: () => Promise<void>;
};

const MerchantAuthContext = createContext<MerchantAuth>({
  shop: null,
  getSessionToken: async () => null,
  clearSessionTokenCache: () => undefined,
  appHref: (p) => p,
  navigate: () => undefined,
  isNavigating: false,
  needsPlanSelection: false,
  refreshBillingGate: async () => undefined,
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
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<string | null>(null);
  const [needsPlanSelection, setNeedsPlanSelection] = useState(false);
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

  const refreshBillingGate = useCallback(async () => {
    try {
      const headers = await merchantAuthHeaders();
      const billingRes = await fetch("/api/billing", { headers });
      if (!billingRes.ok) return;
      const billing = (await billingRes.json()) as { needsPlanSelection?: boolean };
      setNeedsPlanSelection(Boolean(billing.needsPlanSelection));
    } catch {
      /* ignore */
    }
  }, []);

  // Bootstrap once — never again on every route change.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get("shop") ?? getRememberedShop();
    const hostParam = params.get("host") ?? getRememberedHost();
    if (shopParam) rememberShopParams(shopParam, hostParam);
    setShop(shopParam);

    // First-install / billing return often hits APP_URL top-level — push into Admin embed.
    if (redirectStandaloneIntoAdmin(shopParam, hostParam)) {
      return;
    }

    async function bootstrap() {
      if (!shopParam) {
        setReady(true);
        return;
      }

      try {
        const sessionRes = await fetch(`/api/auth/session?shop=${encodeURIComponent(shopParam)}`);
        const sessionJson = await sessionRes.json();
        if (sessionJson.needsAuth) {
          const authQs = new URLSearchParams({ shop: shopParam });
          if (hostParam) authQs.set("host", hostParam);
          window.open(`/api/auth?${authQs.toString()}`, "_top");
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
          const needsPlan = Boolean(billing.needsPlanSelection);
          setNeedsPlanSelection(needsPlan);
          const onPlans = window.location.pathname.startsWith("/plans");

          if (billingReturn) {
            if (billing.current?.slug || billing.billingStatus === "ACTIVE") {
              setNeedsPlanSelection(false);
              router.replace(appHref("/"));
              setReady(true);
              return;
            }
            router.replace(appHref("/plans?welcome=1&billing=return"));
            setReady(true);
            return;
          }

          if (needsPlan && !onPlans) {
            router.replace(appHref("/plans?welcome=1"));
            setReady(true);
            return;
          }
        }
        // If billing fetch fails, leave gate unset — do not lock existing merchants offline.

        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to bootstrap");
        setReady(true);
      }
    }

    void bootstrap();
  }, [router]);

  // Keep merchants on /plans until a plan is chosen — every client navigation.
  useEffect(() => {
    if (!ready || !needsPlanSelection) return;
    if (pathname?.startsWith("/plans")) return;
    router.replace(appHref("/plans?welcome=1"));
  }, [ready, needsPlanSelection, pathname, router]);

  // Turn in-app <a> / Polaris url= clicks into client navigations (sidebar stays mounted).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || isModifiedClick(e)) return;
      const target = e.target as Element | null;
      const a = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = shouldInterceptLink(a);
      if (!href) return;

      // Hard lock: no leaving plans until a plan is selected.
      if (needsPlanSelection) {
        const pathOnly = href.split("?")[0] ?? href;
        if (!pathOnly.startsWith("/plans")) {
          e.preventDefault();
          startTransition(() => {
            router.replace(appHref("/plans?welcome=1"));
          });
          return;
        }
      }

      e.preventDefault();
      startTransition(() => {
        router.push(href);
      });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router, needsPlanSelection]);

  const value = useMemo(
    () => ({
      shop,
      getSessionToken,
      clearSessionTokenCache,
      appHref,
      navigate,
      isNavigating,
      needsPlanSelection,
      refreshBillingGate,
    }),
    [shop, navigate, isNavigating, needsPlanSelection, refreshBillingGate],
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
            <div className={`as-m-shell${needsPlanSelection ? " as-m-shell--plan-lock" : ""}`}>
              {needsPlanSelection ? null : <AppNav />}
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
