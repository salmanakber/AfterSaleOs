import { prisma } from "./client";

export const shopRepository = {
  async findByDomain(shopDomain: string) {
    return prisma.shop.findUnique({ where: { shopDomain } });
  },

  async ensureShop(shopDomain: string, data?: { shopName?: string; email?: string; timezone?: string; currency?: string }) {
    const existing = await prisma.shop.findUnique({ where: { shopDomain } });
    if (existing) {
      if (existing.status === "UNINSTALLED") {
        return prisma.shop.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            uninstalledAt: null,
            installedAt: new Date(),
            shopName: data?.shopName ?? existing.shopName,
            email: data?.email ?? existing.email,
            timezone: data?.timezone ?? existing.timezone,
            currency: data?.currency ?? existing.currency,
          },
        });
      }
      return existing;
    }

    const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
    return prisma.shop.create({
      data: {
        shopDomain,
        shopName: data?.shopName,
        email: data?.email,
        timezone: data?.timezone ?? "UTC",
        currency: data?.currency ?? "USD",
        planId: freePlan?.id,
        status: "ACTIVE",
      },
    });
  },

  async markUninstalled(shopDomain: string) {
    const shop = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shop) return null;
    return prisma.shop.update({
      where: { id: shop.id },
      data: { status: "UNINSTALLED", uninstalledAt: new Date() },
    });
  },
};

export const sessionRepository = {
  async getOfflineSession(shop: string) {
    const id = `offline_${shop}`;
    return prisma.session.findUnique({ where: { id } });
  },

  async deleteSessionsForShop(shop: string) {
    await prisma.session.deleteMany({ where: { shop } });
  },
};

export const usageRepository = {
  periodKey(date = new Date()) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  },

  async getCount(shopId: string, metric: string, periodKey?: string) {
    const key = periodKey ?? this.periodKey();
    const row = await prisma.usageCounter.findUnique({
      where: { shopId_metric_periodKey: { shopId, metric, periodKey: key } },
    });
    return row?.count ?? 0;
  },

  async increment(shopId: string, metric: string, by = 1) {
    const periodKey = this.periodKey();
    return prisma.usageCounter.upsert({
      where: { shopId_metric_periodKey: { shopId, metric, periodKey } },
      create: { shopId, metric, periodKey, count: by },
      update: { count: { increment: by } },
    });
  },
};
