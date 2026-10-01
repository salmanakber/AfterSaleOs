import {
  prisma,
  createTenantClient,
  shopRepository,
  usageRepository,
} from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import {
  requireValidSessionToken,
  SessionTokenStaleError,
  getOfflineSession,
} from "@/lib/shopify/client";

export type MerchantContext = {
  shopDomain: string;
  shopId: string;
  db: ReturnType<typeof createTenantClient>;
  sessionToken?: string;
};

export async function resolveMerchantContext(request: Request): Promise<MerchantContext> {
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const shopHeader =
    request.headers.get("x-shopify-shop") ??
    request.headers.get("x-aftersale-shop") ??
    null;

  if (bearer) {
    const { shop } = await requireValidSessionToken(bearer);
    const shopDomain = normalizeShopDomain(shop);
    const shopRow = await shopRepository.findByDomain(shopDomain);
    if (!shopRow || shopRow.status === "UNINSTALLED") {
      throw new Error("UNAUTHORIZED: Shop is not installed.");
    }
    return {
      shopDomain,
      shopId: shopRow.id,
      db: createTenantClient(shopRow.id),
      sessionToken: bearer,
    };
  }

  if (shopHeader) {
    const shopDomain = normalizeShopDomain(shopHeader);
    const offline = await getOfflineSession(shopDomain);
    if (!offline) throw new SessionTokenStaleError("Offline session missing; provide Bearer token.");
    const shopRow = await shopRepository.findByDomain(shopDomain);
    if (!shopRow || shopRow.status === "UNINSTALLED") {
      throw new Error("UNAUTHORIZED: Shop is not installed.");
    }
    return {
      shopDomain,
      shopId: shopRow.id,
      db: createTenantClient(shopRow.id),
    };
  }

  throw new Error("UNAUTHORIZED: Missing session token or shop header.");
}

export { prisma, shopRepository, usageRepository, SessionTokenStaleError };
