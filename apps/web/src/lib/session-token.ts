import { getRememberedShop } from "./shop-context";

let cached: { token: string; exp: number } | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wait briefly for App Bridge CDN to expose window.shopify.idToken. */
async function waitForShopifyIdToken(timeoutMs = 4000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== "undefined" && typeof window.shopify?.idToken === "function") {
      return true;
    }
    await sleep(50);
  }
  return typeof window !== "undefined" && typeof window.shopify?.idToken === "function";
}

export async function getSessionToken(): Promise<string | null> {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  if (typeof window === "undefined") return null;

  const ready = await waitForShopifyIdToken();
  if (!ready || !window.shopify?.idToken) return null;

  try {
    const token = await window.shopify.idToken();
    cached = { token, exp: Date.now() + 45_000 };
    return token;
  } catch (err) {
    console.warn("[session-token] idToken failed", err);
    cached = null;
    return null;
  }
}

export function clearSessionTokenCache() {
  cached = null;
}

/** Headers for merchant API / GraphQL calls. */
export async function merchantAuthHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  const token = await getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const shop = getRememberedShop();
  if (shop) {
    headers["x-aftersale-shop"] = shop;
    headers["x-shopify-shop"] = shop;
  }
  return headers;
}
