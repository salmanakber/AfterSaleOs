import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTenantClient } from "../src/tenant";

/**
 * Cross-shop isolation test (M0 exit criterion).
 * Requires DATABASE_URL and a migrated database.
 */
const run = process.env.DATABASE_URL ? describe : describe.skip;

run("tenant isolation", () => {
  const prisma = new PrismaClient();
  let shopA: string;
  let shopB: string;
  let claimA: string;

  beforeAll(async () => {
    const a = await prisma.shop.create({
      data: { shopDomain: `iso-a-${Date.now()}.myshopify.com` },
    });
    const b = await prisma.shop.create({
      data: { shopDomain: `iso-b-${Date.now()}.myshopify.com` },
    });
    shopA = a.id;
    shopB = b.id;

    const claim = await prisma.claim.create({
      data: {
        shopId: shopA,
        claimNumber: "AS-1",
        publicToken: `tok_${Date.now()}`,
        issueSummary: "secret-to-shop-a",
      },
    });
    claimA = claim.id;
  });

  afterAll(async () => {
    await prisma.claim.deleteMany({ where: { shopId: { in: [shopA, shopB] } } });
    await prisma.shop.deleteMany({ where: { id: { in: [shopA, shopB] } } });
    await prisma.$disconnect();
  });

  it("blocks shop B from reading shop A claims via tenant client", async () => {
    const dbB = createTenantClient(shopB);
    const found = await dbB.claim.findMany({});
    expect(found.find((c) => c.id === claimA)).toBeUndefined();
  });

  it("allows shop A to read its own claim", async () => {
    const dbA = createTenantClient(shopA);
    const found = await dbA.claim.findMany({});
    expect(found.some((c) => c.id === claimA)).toBe(true);
  });

  it("injects shopId on create so cross-shop spoofing fails", async () => {
    const dbB = createTenantClient(shopB);
    const created = await dbB.claim.create({
      data: {
        // Attempt to spoof shopA — extension should overwrite with shopB
        shopId: shopA,
        claimNumber: "AS-SPOOF",
        publicToken: `tok_spoof_${Date.now()}`,
        issueSummary: "should belong to B",
      } as never,
    });
    expect(created.shopId).toBe(shopB);
    await prisma.claim.delete({ where: { id: created.id } });
  });
});
