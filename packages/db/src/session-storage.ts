import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { prisma } from "./client";

type Storage = PrismaSessionStorage<typeof prisma>;

let storage: Storage | undefined;

/**
 * Lazily construct Shopify session storage.
 * Instantiating PrismaSessionStorage polls `Session` via prisma at construct time,
 * which breaks Next.js builds (admin/web) when DATABASE_URL is unset or DB is offline.
 */
export function getShopifySessionStorage(): Storage {
  if (!storage) {
    storage = new PrismaSessionStorage(prisma, {
      tableName: "Session",
      // Fail fast during accidental early init instead of multi-second retries in builds.
      connectionRetries: process.env.NEXT_PHASE === "phase-production-build" ? 0 : 2,
      connectionRetryIntervalMs: 500,
    });
  }
  return storage;
}

/** @deprecated Prefer getShopifySessionStorage() — kept for call-site compatibility via Proxy. */
export const shopifySessionStorage: Storage = new Proxy({} as Storage, {
  get(_target, prop, _receiver) {
    const instance = getShopifySessionStorage();
    const value = Reflect.get(instance as object, prop, instance);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});
