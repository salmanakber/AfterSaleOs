import { prisma, shopRepository, sessionRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";

/**
 * Real deletion for mandatory privacy webhooks (§5, §41).
 * Attachments must be removed from object storage as well as DB rows.
 */
export async function handleCustomersDataRequest(shopDomain: string, payload: unknown) {
  const shop = await shopRepository.findByDomain(normalizeShopDomain(shopDomain));
  await prisma.privacyRequest.create({
    data: {
      shopId: shop?.id,
      shopDomain: normalizeShopDomain(shopDomain),
      type: "CUSTOMERS_DATA_REQUEST",
      payload: payload as object,
      status: "RECEIVED",
      dueAt: new Date(Date.now() + 30 * 24 * 3600_000),
    },
  });
  // Full export packaging lands in M10 Super Admin compliance tooling.
}

export async function handleCustomersRedact(shopDomain: string, payload: {
  customer?: { id?: number; email?: string; phone?: string };
  orders_to_redact?: number[];
}) {
  const domain = normalizeShopDomain(shopDomain);
  const shop = await shopRepository.findByDomain(domain);
  const request = await prisma.privacyRequest.create({
    data: {
      shopId: shop?.id,
      shopDomain: domain,
      type: "CUSTOMERS_REDACT",
      payload: payload as object,
      status: "IN_PROGRESS",
    },
  });

  if (!shop) {
    await prisma.privacyRequest.update({
      where: { id: request.id },
      data: { status: "COMPLETED", completedAt: new Date(), evidence: { note: "Shop not found" } },
    });
    return;
  }

  const email = payload.customer?.email?.toLowerCase();
  const shopifyCustomerId = payload.customer?.id ? String(payload.customer.id) : null;

  const customers = await prisma.customer.findMany({
    where: {
      shopId: shop.id,
      OR: [
        ...(email ? [{ email }] : []),
        ...(shopifyCustomerId ? [{ shopifyCustomerId }] : []),
      ],
    },
  });

  const customerIds = customers.map((c) => c.id);
  const deletedAttachments = await deleteAttachmentsForCustomers(shop.id, customerIds);

  await prisma.claim.updateMany({
    where: { shopId: shop.id, customerId: { in: customerIds } },
    data: {
      issueSummary: "[redacted]",
      issueDetails: "[redacted]",
    },
  });

  for (const c of customers) {
    await prisma.customer.update({
      where: { id: c.id },
      data: {
        email: null,
        firstName: null,
        lastName: null,
        phone: null,
      },
    });
  }

  await prisma.privacyRequest.update({
    where: { id: request.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      evidence: {
        customersRedacted: customerIds.length,
        attachmentsDeleted: deletedAttachments,
      },
    },
  });
}

export async function handleShopRedact(shopDomain: string) {
  const domain = normalizeShopDomain(shopDomain);
  const shop = await shopRepository.findByDomain(domain);
  const request = await prisma.privacyRequest.create({
    data: {
      shopId: shop?.id,
      shopDomain: domain,
      type: "SHOP_REDACT",
      payload: { shop: domain },
      status: "IN_PROGRESS",
    },
  });

  await sessionRepository.deleteSessionsForShop(domain);

  if (shop) {
    // Delete attachments from storage then cascade shop data
    const attachments = await prisma.attachment.findMany({ where: { shopId: shop.id } });
    await deleteStorageKeys(attachments.map((a) => a.storageKey));

    await prisma.shop.delete({ where: { id: shop.id } });
  }

  await prisma.privacyRequest.update({
    where: { id: request.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      evidence: { shopDeleted: Boolean(shop), sessionsCleared: true },
      shopId: null,
    },
  });
}

export async function handleAppUninstalled(shopDomain: string) {
  const domain = normalizeShopDomain(shopDomain);
  await shopRepository.markUninstalled(domain);
  await sessionRepository.deleteSessionsForShop(domain);
}

async function deleteAttachmentsForCustomers(shopId: string, customerIds: string[]) {
  if (customerIds.length === 0) return 0;
  const claims = await prisma.claim.findMany({
    where: { shopId, customerId: { in: customerIds } },
    select: { id: true },
  });
  const claimIds = claims.map((c) => c.id);
  const attachments = await prisma.attachment.findMany({
    where: { shopId, claimId: { in: claimIds } },
  });
  await deleteStorageKeys(attachments.map((a) => a.storageKey));
  await prisma.attachment.deleteMany({
    where: { id: { in: attachments.map((a) => a.id) } },
  });
  return attachments.length;
}

/** Local filesystem stub; swap for S3/R2 in production. */
async function deleteStorageKeys(keys: string[]) {
  const fs = await import("fs/promises");
  const path = await import("path");
  const root = process.env.UPLOAD_DIR ?? "./uploads";
  for (const key of keys) {
    try {
      await fs.unlink(path.join(root, key));
    } catch {
      // ignore missing files
    }
  }
}
