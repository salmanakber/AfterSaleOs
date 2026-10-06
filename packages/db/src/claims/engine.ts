import { randomBytes } from "crypto";
import { prisma } from "../client";
import { evaluateEligibility, type EligibilityOutcome } from "@aftersale/shared";
import { usageRepository } from "../repositories";
import { assertMonthlyQuota } from "../plan-limits";
import type { ClaimStatus, ClaimSystemState } from "@prisma/client";

const STATUS_TO_SYSTEM: Record<ClaimStatus, ClaimSystemState> = {
  OPEN: "OPEN",
  WAITING_CUSTOMER: "WAITING_CUSTOMER",
  IN_REVIEW: "OPEN",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  IN_RESOLUTION: "IN_RESOLUTION",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

function publicToken() {
  return randomBytes(24).toString("base64url");
}

async function nextClaimNumber(shopId: string) {
  const count = await prisma.claim.count({ where: { shopId } });
  const seq = String(count + 1).padStart(4, "0");
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `AS-${stamp}-${seq}`;
}

export async function computeClaimEligibility(params: {
  shopId: string;
  warrantyId?: string | null;
  serialNumber?: string | null;
}) {
  if (!params.warrantyId) {
    return evaluateEligibility({
      hasMatchingRule: false,
      warrantyStatus: "void",
      withinGracePeriod: false,
      serialMismatch: false,
      requiresManualReview: true,
    });
  }

  const warranty = await prisma.warranty.findFirst({
    where: { id: params.warrantyId, shopId: params.shopId },
    include: {
      ruleVersion: true,
      warrantyUnit: true,
    },
  });

  if (!warranty) {
    return evaluateEligibility({
      hasMatchingRule: false,
      warrantyStatus: "void",
      withinGracePeriod: false,
      serialMismatch: false,
      requiresManualReview: true,
    });
  }

  const statusMap: Record<string, EligibilityInputStatus> = {
    PENDING_START: "pending_start",
    ACTIVE: "active",
    EXPIRING_SOON: "expiring_soon",
    EXPIRED: "expired",
    VOID: "void",
    PENDING_VERIFICATION: "pending_verification",
  };

  let withinGrace = false;
  if (warranty.status === "EXPIRED" && warranty.endAt) {
    const grace = warranty.ruleVersion.gracePeriodDays ?? 0;
    const graceEnd = warranty.endAt.getTime() + grace * 24 * 3600_000;
    withinGrace = Date.now() <= graceEnd;
  }

  let serialMismatch = false;
  if (params.serialNumber && warranty.warrantyUnit.serialNumber) {
    serialMismatch =
      params.serialNumber.trim().toLowerCase() !==
      warranty.warrantyUnit.serialNumber.trim().toLowerCase();
  }

  return evaluateEligibility({
    hasMatchingRule: true,
    warrantyStatus: statusMap[warranty.status] ?? "active",
    withinGracePeriod: withinGrace,
    serialMismatch,
    requiresManualReview: warranty.status === "PENDING_VERIFICATION",
  });
}

type EligibilityInputStatus =
  | "pending_start"
  | "active"
  | "expiring_soon"
  | "expired"
  | "void"
  | "pending_verification";

export async function createClaim(params: {
  shopId: string;
  email: string;
  customerName?: string;
  warrantyId?: string;
  warrantyUnitId?: string;
  certificateToken?: string;
  orderNumber?: string;
  orderLineItemId?: string;
  serialNumber?: string;
  issueCategory?: string;
  issueSummary: string;
  issueDetails?: string;
  attachmentIds?: string[];
  /** Merchant desk / admin — enforce plan claims quota. Customer portal never sets this. */
  enforcePlanQuota?: boolean;
}) {
  if (params.enforcePlanQuota) {
    await assertMonthlyQuota(params.shopId, "claims_created");
  }

  const email = params.email.trim().toLowerCase();

  let warrantyId = params.warrantyId;
  let warrantyUnitId = params.warrantyUnitId;
  let customerId: string | undefined;

  if (params.certificateToken) {
    const w = await prisma.warranty.findUnique({
      where: { certificateToken: params.certificateToken },
      include: { customer: true },
    });
    if (w && w.shopId === params.shopId) {
      warrantyId = w.id;
      warrantyUnitId = w.warrantyUnitId;
      customerId = w.customerId ?? undefined;
    }
  }

  if (!warrantyId && params.orderLineItemId) {
    const unit = await prisma.warrantyUnit.findFirst({
      where: {
        shopId: params.shopId,
        orderLineItemId: params.orderLineItemId,
      },
      include: {
        warranties: {
          where: { status: { not: "VOID" } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        orderLineItem: {
          include: {
            order: { include: { customer: true } },
          },
        },
      },
    });
    if (unit) {
      warrantyUnitId = unit.id;
      const w = unit.warranties[0];
      if (w) {
        warrantyId = w.id;
        customerId = w.customerId ?? undefined;
      }
      const orderCustomer = unit.orderLineItem?.order?.customer;
      if (!customerId && orderCustomer) customerId = orderCustomer.id;
    }
  }

  if (!warrantyId && (params.orderNumber || params.serialNumber)) {
    const w = await prisma.warranty.findFirst({
      where: {
        shopId: params.shopId,
        status: { not: "VOID" },
        OR: [
          ...(params.serialNumber
            ? [{ warrantyUnit: { serialNumber: params.serialNumber.trim() } }]
            : []),
          ...(params.orderNumber
            ? [
                {
                  warrantyUnit: {
                    orderLineItem: {
                      order: {
                        orderNumber: { equals: params.orderNumber.trim(), mode: "insensitive" as const },
                        OR: [{ email }, { customer: { email } }],
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      },
    });
    if (w) {
      warrantyId = w.id;
      warrantyUnitId = w.warrantyUnitId;
      customerId = w.customerId ?? undefined;
    }
  }

  // Attach (or create) a warranty unit so the claim shows product + order.
  if (!warrantyUnitId && params.orderLineItemId) {
    const line = await prisma.orderLineItem.findFirst({
      where: { id: params.orderLineItemId, shopId: params.shopId },
      include: { order: { include: { customer: true } } },
    });
    if (line) {
      let unit = await prisma.warrantyUnit.findFirst({
        where: { shopId: params.shopId, orderLineItemId: line.id },
        orderBy: { unitIndex: "asc" },
      });
      if (!unit) {
        unit = await prisma.warrantyUnit.create({
          data: {
            shopId: params.shopId,
            orderLineItemId: line.id,
            unitIndex: 0,
            serialNumber: params.serialNumber?.trim() || undefined,
          },
        });
      }
      warrantyUnitId = unit.id;
      if (!customerId && line.order.customerId) customerId = line.order.customerId;
    }
  }

  if (!customerId) {
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
        firstName: params.customerName?.split(" ")[0],
        lastName: params.customerName?.split(" ").slice(1).join(" ") || undefined,
      },
      update: { email },
    });
    customerId = customer.id;
  }

  const eligibility = await computeClaimEligibility({
    shopId: params.shopId,
    warrantyId,
    serialNumber: params.serialNumber,
  });

  const claimNumber = await nextClaimNumber(params.shopId);
  const slaDueAt = new Date(Date.now() + 48 * 3600_000);

  const claim = await prisma.claim.create({
    data: {
      shopId: params.shopId,
      claimNumber,
      publicToken: publicToken(),
      customerId,
      customerEmail: email,
      customerName: params.customerName,
      warrantyId,
      warrantyUnitId,
      status: "OPEN",
      systemState: "OPEN",
      issueCategory: params.issueCategory,
      issueSummary: params.issueSummary,
      issueDetails: params.issueDetails,
      eligibilityResult: eligibility.outcome,
      eligibilityReasons: eligibility.reasons,
      slaDueAt,
    },
  });

  if (params.attachmentIds?.length) {
    await prisma.attachment.updateMany({
      where: {
        shopId: params.shopId,
        id: { in: params.attachmentIds },
        claimId: null,
      },
      data: { claimId: claim.id },
    });
  }

  await prisma.claimNote.create({
    data: {
      shopId: params.shopId,
      claimId: claim.id,
      authorType: "system",
      body: `Claim opened. Eligibility: ${eligibility.outcome}. ${eligibility.reasons.join(" ")}`,
      isInternal: true,
    },
  });

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "customer",
      action: "claim.created",
      entityType: "claim",
      entityId: claim.id,
      after: {
        claimNumber,
        eligibility: eligibility.outcome,
      },
    },
  });

  // Never block customer — still count usage for merchant upgrade prompts
  await usageRepository.increment(params.shopId, "claims_created");

  return { claim, eligibility };
}

export async function updateClaimStatus(params: {
  shopId: string;
  claimId: string;
  status: ClaimStatus;
  actorId?: string;
  actorName?: string;
  note?: string;
  isInternalNote?: boolean;
}) {
  const existing = await prisma.claim.findFirst({
    where: { id: params.claimId, shopId: params.shopId },
  });
  if (!existing) throw new Error("Claim not found");

  const systemState = STATUS_TO_SYSTEM[params.status];
  const updated = await prisma.claim.update({
    where: { id: existing.id },
    data: { status: params.status, systemState },
  });

  await prisma.claimNote.create({
    data: {
      shopId: params.shopId,
      claimId: existing.id,
      authorType: params.actorId ? "staff" : "system",
      authorId: params.actorId,
      authorName: params.actorName,
      body: params.note ?? `Status changed to ${params.status}`,
      isInternal: params.isInternalNote ?? false,
    },
  });

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      actorId: params.actorId,
      action: "claim.status_changed",
      entityType: "claim",
      entityId: existing.id,
      before: { status: existing.status },
      after: { status: params.status },
    },
  });

  return updated;
}

export async function addClaimNote(params: {
  shopId: string;
  claimId: string;
  body: string;
  isInternal?: boolean;
  authorType?: "staff" | "customer" | "system";
  authorId?: string;
  authorName?: string;
}) {
  const claim = await prisma.claim.findFirst({
    where: { id: params.claimId, shopId: params.shopId },
  });
  if (!claim) throw new Error("Claim not found");

  return prisma.claimNote.create({
    data: {
      shopId: params.shopId,
      claimId: claim.id,
      body: params.body,
      isInternal: params.isInternal ?? false,
      authorType: params.authorType ?? "staff",
      authorId: params.authorId,
      authorName: params.authorName,
    },
  });
}

export async function assignClaim(params: {
  shopId: string;
  claimId: string;
  assigneeId: string | null;
  actorId?: string;
}) {
  const claim = await prisma.claim.findFirst({
    where: { id: params.claimId, shopId: params.shopId },
  });
  if (!claim) throw new Error("Claim not found");

  if (params.assigneeId) {
    const staff = await prisma.staffMember.findFirst({
      where: { id: params.assigneeId, shopId: params.shopId, active: true },
    });
    if (!staff) throw new Error("Staff member not found");
  }

  const updated = await prisma.claim.update({
    where: { id: claim.id },
    data: { assigneeId: params.assigneeId },
  });

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      actorId: params.actorId,
      action: "claim.assigned",
      entityType: "claim",
      entityId: claim.id,
      after: { assigneeId: params.assigneeId },
    },
  });

  return updated;
}

export async function overrideEligibility(params: {
  shopId: string;
  claimId: string;
  reason: string;
  actorId?: string;
}) {
  const claim = await prisma.claim.findFirst({
    where: { id: params.claimId, shopId: params.shopId },
  });
  if (!claim) throw new Error("Claim not found");

  const updated = await prisma.claim.update({
    where: { id: claim.id },
    data: { eligibilityOverride: true },
  });

  await prisma.claimNote.create({
    data: {
      shopId: params.shopId,
      claimId: claim.id,
      authorType: "staff",
      authorId: params.actorId,
      body: `Eligibility override: ${params.reason}`,
      isInternal: true,
    },
  });

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      actorId: params.actorId,
      action: "claim.eligibility_override",
      entityType: "claim",
      entityId: claim.id,
      after: { reason: params.reason },
    },
  });

  return updated;
}

export function mapEligibilityLabel(outcome: string | null | undefined) {
  switch (outcome as EligibilityOutcome | undefined) {
    case "eligible":
      return "Eligible";
    case "eligible_needs_review":
      return "Eligible — needs review";
    case "outside_warranty_needs_review":
      return "Outside warranty — needs review";
    case "not_covered_by_rule":
      return "Not covered by rule";
    default:
      return outcome ?? "Unknown";
  }
}
