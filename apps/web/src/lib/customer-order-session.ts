/**
 * Browser cache for customer orders on standalone register / claim / portal pages.
 * Uses localStorage (not cookies) so we can store the full order + line-item list.
 * Scoped per shop, expires after 12 hours.
 */

export type CachedOrderLine = {
  id: string;
  title: string;
  quantity: number;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  hasWarranty: boolean;
  certificateToken: string | null;
};

export type CachedOrder = {
  id: string;
  orderNumber: string;
  processedAt: string;
  lineItems: CachedOrderLine[];
};

export type CachedWarranty = {
  id: string;
  status: string;
  productTitle: string;
  orderNumber: string;
  serialNumber: string | null;
  certificateToken: string;
  startAt: string | null;
  endAt: string | null;
  ruleName?: string;
};

export type CustomerOrderSession = {
  shop: string;
  email: string;
  orders: CachedOrder[];
  warranties: CachedWarranty[];
  at: number;
  /** How the session was established */
  source?: "guest_verify" | "portal_token" | "shopify_email" | "lookup";
};

const CACHE_KEY = "aftersale.portal.v1";
const TTL_MS = 1000 * 60 * 60 * 12;

export function loadCustomerOrderSession(shop: string): CustomerOrderSession | null {
  if (!shop || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomerOrderSession>;
    if (parsed.shop !== shop) return null;
    if (!parsed.at || Date.now() - parsed.at > TTL_MS) return null;
    if (!parsed.email || !Array.isArray(parsed.orders)) return null;
    return {
      shop: parsed.shop,
      email: parsed.email,
      orders: parsed.orders,
      warranties: Array.isArray(parsed.warranties) ? parsed.warranties : [],
      at: parsed.at,
      source: parsed.source,
    };
  } catch {
    return null;
  }
}

export function saveCustomerOrderSession(input: {
  shop: string;
  email: string;
  orders: CachedOrder[];
  warranties?: CachedWarranty[];
  source?: CustomerOrderSession["source"];
}): void {
  if (!input.shop || !input.email || typeof window === "undefined") return;
  try {
    const prev = loadCustomerOrderSession(input.shop);
    const payload: CustomerOrderSession = {
      shop: input.shop,
      email: input.email.toLowerCase().trim(),
      orders: input.orders,
      warranties: input.warranties ?? prev?.warranties ?? [],
      at: Date.now(),
      source: input.source ?? prev?.source ?? "lookup",
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearCustomerOrderSession(shop?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!shop) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    const cur = loadCustomerOrderSession(shop);
    if (cur || localStorage.getItem(CACHE_KEY)) {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { shop?: string };
      if (!parsed.shop || parsed.shop === shop) localStorage.removeItem(CACHE_KEY);
    }
  } catch {
    /* ignore */
  }
}
