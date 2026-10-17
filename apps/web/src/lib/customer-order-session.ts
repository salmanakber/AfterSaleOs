/**
 * Browser cache for customer orders on standalone register / claim / portal pages.
 * Uses localStorage (not cookies) so we can store the full order + line-item list.
 * Scoped per shop, expires after 12 hours.
 *
 * Warranty fee line items are stripped — they are a checkout charge, not a product.
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
  source?: "guest_verify" | "portal_token" | "shopify_email" | "lookup" | "portal";
};

const CACHE_KEY = "aftersale.portal.v1";
const TTL_MS = 1000 * 60 * 60 * 12;

/** Fee SKU / checkout charge — never treat as a coverable product. */
export function isWarrantyFeeCachedLine(
  li: { shopifyVariantId?: string | null; title?: string | null },
  feeVariantId?: string | null,
): boolean {
  if (feeVariantId) {
    const want = String(feeVariantId).replace(/\D/g, "");
    const vid = String(li.shopifyVariantId ?? "").replace(/\D/g, "");
    if (want && vid && want === vid) return true;
  }
  const t = (li.title ?? "").toLowerCase().trim();
  return (
    t === "warranty fee" ||
    t === "warranty registration" ||
    t === "product warranty registration" ||
    /^warranty\s+(fee|registration)\b/.test(t)
  );
}

export function stripWarrantyFeeFromOrders(
  orders: CachedOrder[],
  feeVariantId?: string | null,
): CachedOrder[] {
  return orders
    .map((o) => ({
      ...o,
      lineItems: o.lineItems.filter((li) => !isWarrantyFeeCachedLine(li, feeVariantId)),
    }))
    .filter((o) => o.lineItems.length > 0);
}

export function stripWarrantyFeeFromWarranties(
  warranties: CachedWarranty[],
  feeVariantId?: string | null,
): CachedWarranty[] {
  return warranties.filter(
    (w) => !isWarrantyFeeCachedLine({ title: w.productTitle }, feeVariantId),
  );
}

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
      orders: stripWarrantyFeeFromOrders(parsed.orders),
      warranties: stripWarrantyFeeFromWarranties(
        Array.isArray(parsed.warranties) ? parsed.warranties : [],
      ),
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
  feeVariantId?: string | null;
}): void {
  if (!input.shop || !input.email || typeof window === "undefined") return;
  try {
    const prev = loadCustomerOrderSession(input.shop);
    const payload: CustomerOrderSession = {
      shop: input.shop,
      email: input.email.toLowerCase().trim(),
      orders: stripWarrantyFeeFromOrders(input.orders, input.feeVariantId),
      warranties: stripWarrantyFeeFromWarranties(
        input.warranties ?? prev?.warranties ?? [],
        input.feeVariantId,
      ),
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

/** Survives refresh so Shopify `logged_in_customer_id` does not auto-login after Sign out. */
const SIGNED_OUT_KEY = "aftersale.portal.signedOut.v1";

export function markPortalSignedOut(shop: string): void {
  if (!shop || typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SIGNED_OUT_KEY,
      JSON.stringify({ shop, at: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function clearPortalSignedOutFlag(shop?: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SIGNED_OUT_KEY);
    if (!raw) return;
    if (!shop) {
      localStorage.removeItem(SIGNED_OUT_KEY);
      return;
    }
    const parsed = JSON.parse(raw) as { shop?: string };
    if (!parsed.shop || parsed.shop === shop) localStorage.removeItem(SIGNED_OUT_KEY);
  } catch {
    localStorage.removeItem(SIGNED_OUT_KEY);
  }
}

export function isPortalSignedOut(shop: string): boolean {
  if (!shop || typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SIGNED_OUT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { shop?: string; at?: number };
    if (parsed.shop !== shop) return false;
    // Expire opt-out after 30 days so intentional Shopify SSO can recover naturally.
    if (!parsed.at || Date.now() - parsed.at > 1000 * 60 * 60 * 24 * 30) {
      localStorage.removeItem(SIGNED_OUT_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
