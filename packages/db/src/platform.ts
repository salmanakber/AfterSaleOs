import { prisma } from "./client";

export const PLATFORM_KEYS = {
  SHOPIFY_BILLING_TEST: "shopify_billing_test",
} as const;

export async function getPlatformSetting(key: string): Promise<string | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setPlatformSetting(key: string, value: string) {
  return prisma.platformSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Prefer Super Admin toggle; fall back to SHOPIFY_BILLING_TEST env. */
export async function isShopifyBillingTestMode(): Promise<boolean> {
  const stored = await getPlatformSetting(PLATFORM_KEYS.SHOPIFY_BILLING_TEST);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return process.env.SHOPIFY_BILLING_TEST === "true";
}
