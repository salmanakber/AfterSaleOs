/** Build Shopify Admin URLs that load this app embedded (not standalone APP_URL). */

export function shopHandleFromDomain(shop: string): string {
  return shop.replace(/\.myshopify\.com$/i, "").trim();
}

/**
 * Prefer the App Store handle (e.g. aftersale-os) over the raw API key in Admin URLs.
 * Mixing handle ↔ client_id URLs causes install redirect loops in Admin.
 */
export function shopifyAppAdminSlug(apiKey?: string): string {
  const handle = (process.env.SHOPIFY_APP_HANDLE || process.env.NEXT_PUBLIC_SHOPIFY_APP_HANDLE || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (handle) return handle;
  return (apiKey || process.env.SHOPIFY_API_KEY || process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || "").trim();
}

/**
 * Decode Shopify's `host` query param (base64) → e.g. `admin.shopify.com/store/acme`.
 * Returns null if missing/invalid.
 */
export function decodeShopifyHost(host: string | null | undefined): string | null {
  if (!host) return null;
  try {
    const decoded = Buffer.from(host, "base64").toString("utf8").replace(/^https?:\/\//, "");
    if (!decoded || decoded.includes("://")) return null;
    // Expect admin.shopify.com/store/... or {shop}.myshopify.com/admin
    if (!/admin\.shopify\.com|myshopify\.com/i.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Query keys Shopify injects — drop them from deep-link paths we attach under /apps/{apiKey}. */
const SHOPIFY_FRAME_PARAMS = new Set([
  "shop",
  "host",
  "hmac",
  "timestamp",
  "session",
  "embedded",
  "locale",
  "id_token",
]);

/**
 * Absolute Admin URL that opens the embedded app at `path`.
 * Example: https://admin.shopify.com/store/acme/apps/{apiKey}/plans?welcome=1
 */
export function embeddedAdminAppUrl(opts: {
  path?: string;
  shop: string;
  host?: string | null;
  apiKey?: string;
}): string {
  const apiKey = opts.apiKey || process.env.SHOPIFY_API_KEY || process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || "";
  const appSlug = shopifyAppAdminSlug(apiKey);
  const rawPath = opts.path || "/";
  const splitAt = rawPath.indexOf("?");
  const pathnamePart = splitAt >= 0 ? rawPath.slice(0, splitAt) : rawPath;
  const searchPart = splitAt >= 0 ? rawPath.slice(splitAt + 1) : "";
  const pathname = pathnamePart.startsWith("/") ? pathnamePart : `/${pathnamePart}`;

  const qs = new URLSearchParams(searchPart);
  for (const key of [...qs.keys()]) {
    if (SHOPIFY_FRAME_PARAMS.has(key)) qs.delete(key);
  }
  const q = qs.toString();
  const suffix = q ? `${pathname}?${q}` : pathname === "/" ? "" : pathname;

  const decodedHost = decodeShopifyHost(opts.host);
  if (decodedHost && appSlug) {
    return `https://${decodedHost}/apps/${appSlug}${suffix || ""}`;
  }

  const storeHandle = shopHandleFromDomain(opts.shop);
  if (appSlug && storeHandle) {
    return `https://admin.shopify.com/store/${storeHandle}/apps/${appSlug}${suffix || ""}`;
  }

  // Last resort: standalone app URL (should be rare).
  const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const fallbackQs = new URLSearchParams(q);
  if (opts.shop) fallbackQs.set("shop", opts.shop);
  if (opts.host) fallbackQs.set("host", opts.host);
  const fq = fallbackQs.toString();
  return `${appUrl}${pathname}${fq ? `?${fq}` : ""}`;
}
