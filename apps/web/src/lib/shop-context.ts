const SHOP_KEY = "aftersale_shop";
const HOST_KEY = "aftersale_host";

/** Persist embedded-app identity so client navigations don't drop ?shop=. */
export function rememberShopParams(shop?: string | null, host?: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (shop) sessionStorage.setItem(SHOP_KEY, shop);
    if (host) sessionStorage.setItem(HOST_KEY, host);
  } catch {
    /* ignore */
  }
}

export function getRememberedShop(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("shop");
    if (fromUrl) {
      rememberShopParams(fromUrl, new URLSearchParams(window.location.search).get("host"));
      return fromUrl;
    }
    return sessionStorage.getItem(SHOP_KEY);
  } catch {
    return null;
  }
}

export function getRememberedHost(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      new URLSearchParams(window.location.search).get("host") ?? sessionStorage.getItem(HOST_KEY)
    );
  } catch {
    return null;
  }
}

/** Build an in-app href that keeps shop/host for Auth + GraphQL. */
export function appHref(path: string): string {
  const shop = getRememberedShop();
  const host = getRememberedHost();
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "https://local");
  if (shop && !url.searchParams.get("shop")) url.searchParams.set("shop", shop);
  if (host && !url.searchParams.get("host")) url.searchParams.set("host", host);
  return `${url.pathname}${url.search}${url.hash}`;
}
