/** Absolute base for public customer APIs (works inside Shopify app-proxy iframes). */
export function publicAppBase(): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
  if (typeof window === "undefined") return env;

  // Already on the app host — relative paths are fine.
  if (!env || window.location.origin === env) return "";

  // Storefront proxy / foreign embed parent — call the real app origin.
  return env;
}

export function publicApiUrl(path: string): string {
  const base = publicAppBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
}

export function customerPageUrl(path: string, shop?: string, extra?: Record<string, string | undefined>) {
  const base = publicAppBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(base ? `${base}${normalized}` : normalized, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (shop) url.searchParams.set("shop", shop);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  if (!base && typeof window !== "undefined") {
    return `${url.pathname}${url.search}`;
  }
  return url.toString();
}
