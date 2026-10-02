import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "../client";
import {
  buildWarrantyDates,
  randomCertificateToken,
  type StartDateRuleKind,
} from "@aftersale/shared";
import { usageRepository } from "../repositories";

export type SerialValidationResult =
  | { ok: true; mode: string; needsReview?: boolean }
  | { ok: false; code: "REQUIRED" | "DUPLICATE" | "NOT_IN_LIST" | "ALREADY_CLAIMED"; needsReview?: boolean };

/**
 * Serial validation per rule mode (§4.7).
 * Never reveal who owns a serial in API responses to customers.
 */
export async function validateSerial(params: {
  shopId: string;
  serial: string | null | undefined;
  serialMode: string;
  serialListId?: string | null;
}): Promise<SerialValidationResult> {
  const serial = params.serial?.trim();
  const mode = params.serialMode;

  if (mode === "NOT_REQUIRED") {
    return { ok: true, mode };
  }

  if (!serial) {
    return { ok: false, code: "REQUIRED" };
  }

  if (mode === "CUSTOMER_ENTERED_UNIQUE") {
    const existing = await prisma.warrantyUnit.findFirst({
      where: { shopId: params.shopId, serialNumber: serial },
    });
    if (existing) return { ok: false, code: "DUPLICATE", needsReview: true };
    return { ok: true, mode };
  }

  if (mode === "VALIDATED_AGAINST_LIST") {
    const entry = await prisma.serialNumber.findFirst({
      where: {
        shopId: params.shopId,
        serial,
        ...(params.serialListId ? { serialListId: params.serialListId } : {}),
      },
    });
    if (!entry) return { ok: false, code: "NOT_IN_LIST", needsReview: true };
    if (entry.claimedAt || entry.warrantyUnitId) {
      return { ok: false, code: "ALREADY_CLAIMED", needsReview: true };
    }
    return { ok: true, mode };
  }

  if (mode === "ASSIGNED_AT_FULFILLMENT") {
    const unit = await prisma.warrantyUnit.findFirst({
      where: { shopId: params.shopId, serialNumber: serial, status: "ACTIVE" },
    });
    if (!unit) return { ok: false, code: "NOT_IN_LIST", needsReview: true };
    return { ok: true, mode };
  }

  return { ok: true, mode };
}

export async function submitRegistration(params: {
  shopId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  serialNumber?: string;
  purchaseDate?: Date | null;
  sellerName?: string;
  proofUrl?: string;
  productTitle?: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  orderNumber?: string;
  ruleId?: string;
  source?: string;
  outsideShopify?: boolean;
}) {
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: params.shopId } });
  const email = params.email.trim().toLowerCase();

  // Resolve rule: explicit → product assignment → default
  let rule = params.ruleId
    ? await prisma.warrantyRule.findFirst({
        where: { id: params.ruleId, shopId: params.shopId, active: true },
        include: { versions: { orderBy: { version: "desc" } }, assignments: true },
      })
    : null;

  if (!rule && params.shopifyProductId) {
    const assigned = await prisma.ruleAssignment.findFirst({
      where: {
        shopId: params.shopId,
        OR: [
          { targetType: "product", targetId: params.shopifyProductId },
          ...(params.shopifyVariantId
            ? [{ targetType: "variant", targetId: params.shopifyVariantId }]
            : []),
        ],
      },
      include: { rule: { include: { versions: { orderBy: { version: "desc" } }, assignments: true } } },
    });
    if (assigned?.rule.active) rule = assigned.rule;
  }

  if (!rule) {
    const defaultAssignment = await prisma.ruleAssignment.findFirst({
      where: { shopId: params.shopId, targetType: "default" },
      include: { rule: { include: { versions: { orderBy: { version: "desc" } }, assignments: true } } },
    });
    if (defaultAssignment?.rule.active) rule = defaultAssignment.rule;
  }

  const version =
    rule &&
    ((rule.currentVersionId
      ? rule.versions.find((v) => v.id === rule!.currentVersionId)
      : null) ??
      rule.versions[0]);

  const serialMode = version?.serialMode ?? "NOT_REQUIRED";
  const serialList =
    rule && serialMode === "VALIDATED_AGAINST_LIST"
      ? await prisma.serialList.findFirst({
          where: { shopId: params.shopId, ruleId: rule.id },
        })
      : null;

  let serialCheck: SerialValidationResult;
  if (serialMode === "VALIDATED_AGAINST_LIST" && !serialList) {
    serialCheck = { ok: false, code: "NOT_IN_LIST", needsReview: true };
  } else {
    serialCheck = await validateSerial({
      shopId: params.shopId,
      serial: params.serialNumber,
      serialMode,
      serialListId: serialList?.id,
    });
  }

  let status: "PENDING_VERIFICATION" | "APPROVED" | "NEEDS_REVIEW" = "PENDING_VERIFICATION";
  if (params.outsideShopify) {
    status = "PENDING_VERIFICATION";
  } else if (!serialCheck.ok && serialCheck.needsReview) {
    status = "NEEDS_REVIEW";
  } else if (!serialCheck.ok && serialCheck.code === "REQUIRED") {
    throw Object.assign(new Error("Serial number is required"), { code: "SERIAL_REQUIRED" });
  } else if (serialCheck.ok && version && !params.outsideShopify) {
    // Auto-approve clean Shopify-linked registrations without serial conflicts
    status = serialMode === "NOT_REQUIRED" || serialCheck.ok ? "APPROVED" : "PENDING_VERIFICATION";
  }

  const customer = await prisma.customer.upsert({
    where: {
      shopId_shopifyCustomerId: {
        shopId: params.shopId,
        shopifyCustomerId: `email:${email}`,
      },
    },
    create: {
      shopId: params.shopId,
      shopifyCustomerId: `email:${email}`,
      email,
      firstName: params.firstName,
      lastName: params.lastName,
    },
    update: {
      firstName: params.firstName,
      lastName: params.lastName,
    },
  });

  let warrantyUnitId: string | undefined;
  let warrantyId: string | undefined;

  if (status === "APPROVED" && version) {
    const created = await materializeRegistrationWarranty({
      shopId: params.shopId,
      shopTimezone: shop.timezone,
      customerId: customer.id,
      email,
      versionId: version.id,
      startDateRule: version.startDateRule as StartDateRuleKind,
      durationMonths: version.durationMonths,
      serialNumber: params.serialNumber,
      purchaseDate: params.purchaseDate ?? new Date(),
      productTitle: params.productTitle ?? "Registered product",
      shopifyProductId: params.shopifyProductId,
      shopifyVariantId: params.shopifyVariantId,
      orderNumber: params.orderNumber,
    });
    warrantyUnitId = created.unitId;
    warrantyId = created.warrantyId;

    if (params.serialNumber && serialMode === "VALIDATED_AGAINST_LIST") {
      await prisma.serialNumber.updateMany({
        where: {
          shopId: params.shopId,
          serial: params.serialNumber.trim(),
          claimedAt: null,
        },
        data: { claimedAt: new Date(), warrantyUnitId },
      });
    }
  }

  const registration = await prisma.registration.create({
    data: {
      shopId: params.shopId,
      customerId: customer.id,
      warrantyUnitId,
      warrantyId,
      email,
      firstName: params.firstName,
      lastName: params.lastName,
      serialNumber: params.serialNumber?.trim(),
      purchaseDate: params.purchaseDate ?? undefined,
      sellerName: params.sellerName,
      proofUrl: params.proofUrl,
      productTitle: params.productTitle,
      shopifyProductId: params.shopifyProductId,
      shopifyVariantId: params.shopifyVariantId,
      orderNumber: params.orderNumber,
      status,
      source: params.outsideShopify ? "outside_shopify" : params.source ?? "form",
      reviewNote: !serialCheck.ok ? `serial:${serialCheck.code}` : undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "customer",
      action: "registration.submitted",
      entityType: "registration",
      entityId: registration.id,
      after: { status, serialOk: serialCheck.ok },
    },
  });

  return {
    registration,
    // Customer-facing message must not leak ownership of serials
    message:
      status === "APPROVED"
        ? "Registration complete. Your warranty is ready."
        : status === "NEEDS_REVIEW"
          ? "We received your registration and will review it shortly."
          : "Registration submitted. We will verify your purchase and notify you.",
    certificateToken:
      warrantyId
        ? (
            await prisma.warranty.findUnique({ where: { id: warrantyId } })
          )?.certificateToken
        : null,
  };
}

async function materializeRegistrationWarranty(params: {
  shopId: string;
  shopTimezone: string;
  customerId: string;
  email: string;
  versionId: string;
  startDateRule: StartDateRuleKind;
  durationMonths: number | null;
  serialNumber?: string;
  purchaseDate: Date;
  productTitle: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  orderNumber?: string;
}) {
  const order = await prisma.order.create({
    data: {
      shopId: params.shopId,
      shopifyOrderId: `reg_${Date.now()}_${randomBytes(3).toString("hex")}`,
      orderNumber: params.orderNumber ?? `REG-${Date.now()}`,
      customerId: params.customerId,
      email: params.email,
      processedAt: params.purchaseDate,
      fulfilledAt: params.purchaseDate,
      currency: "USD",
    },
  });

  const line = await prisma.orderLineItem.create({
    data: {
      shopId: params.shopId,
      orderId: order.id,
      shopifyLineItemId: `reg_line_${Date.now()}`,
      shopifyProductId: params.shopifyProductId,
      shopifyVariantId: params.shopifyVariantId,
      title: params.productTitle,
      quantity: 1,
    },
  });

  const unit = await prisma.warrantyUnit.create({
    data: {
      shopId: params.shopId,
      orderLineItemId: line.id,
      unitIndex: 0,
      serialNumber: params.serialNumber?.trim(),
      status: "ACTIVE",
    },
  });

  const dates = buildWarrantyDates({
    startDateRule: params.startDateRule === "REGISTRATION_DATE" ? "REGISTRATION_DATE" : params.startDateRule,
    durationMonths: params.durationMonths,
    timeZone: params.shopTimezone,
    purchaseAt: params.purchaseDate,
    fulfilledAt: params.purchaseDate,
    registrationAt: new Date(),
  });

  const warranty = await prisma.warranty.create({
    data: {
      shopId: params.shopId,
      warrantyUnitId: unit.id,
      customerId: params.customerId,
      ruleVersionId: params.versionId,
      source: "REGISTRATION",
      status: dates.status,
      startAt: dates.startAt,
      endAt: dates.endAt,
      timezone: params.shopTimezone,
      certificateToken: randomCertificateToken(),
    },
  });

  await usageRepository.increment(params.shopId, "warranties_created");
  return { unitId: unit.id, warrantyId: warranty.id };
}

export async function approveRegistration(params: {
  shopId: string;
  registrationId: string;
  actorId?: string;
}) {
  const reg = await prisma.registration.findFirst({
    where: { id: params.registrationId, shopId: params.shopId },
  });
  if (!reg) throw new Error("Registration not found");
  if (reg.status === "APPROVED") return reg;

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: params.shopId } });

  // Find a default/active rule version
  const defaultAssignment = await prisma.ruleAssignment.findFirst({
    where: { shopId: params.shopId, targetType: "default" },
    include: { rule: { include: { versions: { orderBy: { version: "desc" } } } } },
  });
  const rule = defaultAssignment?.rule;
  const version = rule
    ? (rule.currentVersionId
        ? rule.versions.find((v) => v.id === rule.currentVersionId)
        : null) ?? rule.versions[0]
    : null;
  if (!version || !reg.customerId) throw new Error("Cannot approve without an active warranty rule");

  const created = await materializeRegistrationWarranty({
    shopId: params.shopId,
    shopTimezone: shop.timezone,
    customerId: reg.customerId,
    email: reg.email ?? "unknown@example.com",
    versionId: version.id,
    startDateRule: version.startDateRule as StartDateRuleKind,
    durationMonths: version.durationMonths,
    serialNumber: reg.serialNumber ?? undefined,
    purchaseDate: reg.purchaseDate ?? new Date(),
    productTitle: reg.productTitle ?? "Registered product",
    shopifyProductId: reg.shopifyProductId ?? undefined,
    shopifyVariantId: reg.shopifyVariantId ?? undefined,
    orderNumber: reg.orderNumber ?? undefined,
  });

  const updated = await prisma.registration.update({
    where: { id: reg.id },
    data: {
      status: "APPROVED",
      warrantyUnitId: created.unitId,
      warrantyId: created.warrantyId,
    },
  });

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      actorId: params.actorId,
      action: "registration.approved",
      entityType: "registration",
      entityId: reg.id,
    },
  });

  return updated;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateGuestToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * Guest portal access (§4.12): identical response whether or not order exists (anti-enumeration).
 */
export async function requestGuestMagicLink(params: {
  shopId: string;
  email: string;
  orderNumber: string;
}): Promise<{ accepted: true }> {
  const email = params.email.trim().toLowerCase();
  const orderNumber = params.orderNumber.trim();

  const order = await prisma.order.findFirst({
    where: {
      shopId: params.shopId,
      orderNumber: { equals: orderNumber, mode: "insensitive" },
      OR: [{ email }, { customer: { email } }],
    },
  });

  // Always behave the same; only create token when match exists
  if (order) {
    const token = generateGuestToken();
    await prisma.guestAccessToken.create({
      data: {
        shopId: params.shopId,
        email,
        orderNumber: order.orderNumber,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    // Return token only via email in production — here we store and email worker sends it.
    // Attach plaintext token on a side channel for the email job:
    await prisma.job.create({
      data: {
        shopId: params.shopId,
        type: "guest_magic_link",
        status: "PENDING",
        payload: {
          email,
          orderNumber: order.orderNumber,
          token,
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        },
      },
    });
  }

  return { accepted: true };
}

export async function consumeGuestToken(token: string) {
  const tokenHash = hashToken(token);
  const row = await prisma.guestAccessToken.findUnique({ where: { tokenHash } });
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  await prisma.guestAccessToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return row;
}

export async function getPortalWarranties(params: {
  shopId: string;
  email: string;
  orderNumber?: string | null;
}) {
  const email = params.email.toLowerCase();
  return prisma.warranty.findMany({
    where: {
      shopId: params.shopId,
      status: { not: "VOID" },
      OR: [
        { customer: { email } },
        {
          warrantyUnit: {
            orderLineItem: {
              order: {
                email,
                ...(params.orderNumber
                  ? { orderNumber: { equals: params.orderNumber, mode: "insensitive" as const } }
                  : {}),
              },
            },
          },
        },
      ],
    },
    include: {
      ruleVersion: { include: { rule: true } },
      warrantyUnit: { include: { orderLineItem: { include: { order: true } } } },
      customer: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
