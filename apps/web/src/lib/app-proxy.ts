import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify Shopify app proxy signature.
 * https://shopify.dev/docs/apps/online-store/app-proxies#calculate-a-digital-signature
 */
export function verifyAppProxySignature(
  searchParams: URLSearchParams,
  secret: string,
): boolean {
  const signature = searchParams.get("signature");
  if (!signature || !secret) return false;

  const entries: string[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (key === "signature") continue;
    entries.push(`${key}=${value}`);
  }
  entries.sort();
  const message = entries.join("");
  const digest = createHmac("sha256", secret).update(message).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}

export function shopDomainFromProxy(searchParams: URLSearchParams): string | null {
  const shop = searchParams.get("shop");
  return shop ? shop.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase() : null;
}
