import { prisma } from "../client";
import type { RepairStatus, ReplacementWarrantyMode, SupplierClaimStatus } from "@prisma/client";
import { updateClaimStatus } from "../claims/engine";
import { buildWarrantyDates, randomCertificateToken } from "@aftersale/shared";

async function nextNumber(shopId: string, prefix: string, countFn: () => Promise<number>) {
  const n = await countFn();
  return `${prefix}-${String(n + 1).padStart(5, "0")}`;
}

const REPAIR_FLOW: RepairStatus[] = [
  "REPAIR_REQUIRED",
  "PRODUCT_RECEIVED",
  "DIAGNOSIS",
  "REPAIRING",
  "QUALITY_CHECK",
  "READY",
  "SHIPPED",
  "COMPLETED",
];

export async function createRepair(params: {
  shopId: string;
  claimId: string;
  technicianId?: string;
  locationId?: string;
  notes?: string;
}) {
  const claim = await prisma.claim.findFirst({
    where: { id: params.claimId, shopId: params.shopId },
  });
  if (!claim) throw new Error("Claim not found");

  const repairNumber = await nextNumber(params.shopId, "RP", () =>
    prisma.repair.count({ where: { shopId: params.shopId } }),
  );

  const repair = await prisma.repair.create({
    data: {
      shopId: params.shopId,
      repairNumber,
      claimId: claim.id,
      warrantyUnitId: claim.warrantyUnitId,
      technicianId: params.technicianId,
      locationId: params.locationId,
      notes: params.notes,
      status: "REPAIR_REQUIRED",
    },
  });

  await updateClaimStatus({
    shopId: params.shopId,
    claimId: claim.id,
    status: "IN_RESOLUTION",
    note: `Repair ${repairNumber} created`,
  });

  await prisma.resolution.create({
    data: {
      shopId: params.shopId,
      claimId: claim.id,
      type: "REPAIR",
      reason: `Repair ${repairNumber}`,
      meta: { repairId: repair.id },
    },
  });

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      action: "repair.created",
      entityType: "repair",
      entityId: repair.id,
      after: { claimId: claim.id, repairNumber },
    },
  });

  return repair;
}

export async function updateRepair(params: {
  shopId: string;
  repairId: string;
  status?: RepairStatus;
  diagnosis?: string;
  notes?: string;
  repairCostCents?: number;
  shippingIn?: string;
  shippingOut?: string;
  technicianId?: string | null;
}) {
  const existing = await prisma.repair.findFirst({
    where: { id: params.repairId, shopId: params.shopId },
  });
  if (!existing) throw new Error("Repair not found");

  if (params.status && params.status !== "CANCELLED") {
    const from = REPAIR_FLOW.indexOf(existing.status);
    const to = REPAIR_FLOW.indexOf(params.status);
    if (from >= 0 && to >= 0 && to < from) {
      // allow backward for corrections but log
    }
  }

  const updated = await prisma.repair.update({
    where: { id: existing.id },
    data: {
      status: params.status,
      diagnosis: params.diagnosis,
      notes: params.notes,
      repairCostCents: params.repairCostCents,
      shippingIn: params.shippingIn,
      shippingOut: params.shippingOut,
      technicianId: params.technicianId === undefined ? undefined : params.technicianId,
      completedAt: params.status === "COMPLETED" ? new Date() : undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      action: "repair.updated",
      entityType: "repair",
      entityId: updated.id,
      before: { status: existing.status },
      after: { status: updated.status },
    },
  });

  if (params.status === "COMPLETED") {
    await updateClaimStatus({
      shopId: params.shopId,
      claimId: existing.claimId,
      status: "COMPLETED",
      note: `Repair ${existing.repairNumber} completed`,
    });
  }

  return updated;
}

export async function recordReplacement(params: {
  shopId: string;
  claimId: string;
  shopifyDraftOrderId?: string;
  shopifyDraftOrderName?: string;
  variantId?: string;
  productTitle?: string;
  warrantyMode?: ReplacementWarrantyMode;
  adminOrderUrl?: string;
}) {
  const claim = await prisma.claim.findFirst({
    where: { id: params.claimId, shopId: params.shopId },
  });
  if (!claim) throw new Error("Claim not found");

  const replacement = await prisma.replacement.create({
    data: {
      shopId: params.shopId,
      claimId: claim.id,
      shopifyDraftOrderId: params.shopifyDraftOrderId,
      shopifyDraftOrderName: params.shopifyDraftOrderName,
      variantId: params.variantId,
      productTitle: params.productTitle,
      warrantyMode: params.warrantyMode ?? "INHERIT_REMAINING",
      adminOrderUrl: params.adminOrderUrl,
      status: "draft_created",
    },
  });

  await updateClaimStatus({
    shopId: params.shopId,
    claimId: claim.id,
    status: "IN_RESOLUTION",
    note: `Replacement draft order created${params.shopifyDraftOrderName ? `: ${params.shopifyDraftOrderName}` : ""}`,
  });

  await prisma.resolution.create({
    data: {
      shopId: params.shopId,
      claimId: claim.id,
      type: "REPLACEMENT",
      reason: "Replacement via draft order",
      meta: { replacementId: replacement.id },
    },
  });

  return replacement;
}

export async function completeReplacementWarranty(params: {
  shopId: string;
  replacementId: string;
  shopifyOrderId?: string;
}) {
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: params.shopId } });
  const replacement = await prisma.replacement.findFirst({
    where: { id: params.replacementId, shopId: params.shopId },
    include: {
      claim: {
        include: {
          warranty: { include: { ruleVersion: true } },
          warrantyUnit: true,
        },
      },
    },
  });
  if (!replacement) throw new Error("Replacement not found");

  let newWarrantyId: string | undefined;
  const old = replacement.claim.warranty;
  if (old) {
    const mode = replacement.warrantyMode;
    let startAt = old.startAt ?? new Date();
    let endAt = old.endAt;
    if (mode === "RESTART") {
      startAt = new Date();
      const dates = buildWarrantyDates({
        startDateRule: old.ruleVersion.startDateRule as never,
        durationMonths: old.ruleVersion.durationMonths,
        timeZone: shop.timezone,
        purchaseAt: startAt,
        fulfilledAt: startAt,
      });
      endAt = dates.endAt;
    }

    const warranty = await prisma.warranty.create({
      data: {
        shopId: params.shopId,
        warrantyUnitId: old.warrantyUnitId,
        customerId: old.customerId,
        ruleVersionId: old.ruleVersionId,
        source: "MANUAL",
        status: endAt && endAt.getTime() < Date.now() ? "EXPIRED" : "ACTIVE",
        startAt,
        endAt,
        timezone: shop.timezone,
        certificateToken: randomCertificateToken(),
      },
    });
    newWarrantyId = warranty.id;
  }

  return prisma.replacement.update({
    where: { id: replacement.id },
    data: {
      status: "completed",
      shopifyOrderId: params.shopifyOrderId,
      newWarrantyId,
    },
  });
}

export async function recordRefund(params: {
  shopId: string;
  claimId: string;
  amountCents: number;
  currency?: string;
  reason?: string;
  shopifyOrderId?: string;
  shopifyRefundId?: string;
  issuedInShopify?: boolean;
  adminDeepLink?: string;
}) {
  const claim = await prisma.claim.findFirst({
    where: { id: params.claimId, shopId: params.shopId },
  });
  if (!claim) throw new Error("Claim not found");

  const resolution = await prisma.resolution.create({
    data: {
      shopId: params.shopId,
      claimId: claim.id,
      type: "REFUND",
      amountCents: params.amountCents,
      currency: params.currency ?? "USD",
      reason: params.reason,
      shopifyOrderId: params.shopifyOrderId,
      shopifyRefundId: params.shopifyRefundId,
      issuedInShopify: params.issuedInShopify ?? false,
      adminDeepLink: params.adminDeepLink,
    },
  });

  await updateClaimStatus({
    shopId: params.shopId,
    claimId: claim.id,
    status: "IN_RESOLUTION",
    note: `Refund recorded: ${(params.amountCents / 100).toFixed(2)} ${params.currency ?? "USD"}`,
  });

  return resolution;
}

export async function createSupplier(params: {
  shopId: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}) {
  return prisma.supplier.create({
    data: {
      shopId: params.shopId,
      name: params.name,
      email: params.email,
      phone: params.phone,
      notes: params.notes,
    },
  });
}

export async function linkProductSupplier(params: {
  shopId: string;
  supplierId: string;
  shopifyProductId: string;
  supplierWarrantyMonths?: number;
}) {
  return prisma.productSupplier.upsert({
    where: {
      shopId_shopifyProductId_supplierId: {
        shopId: params.shopId,
        shopifyProductId: params.shopifyProductId,
        supplierId: params.supplierId,
      },
    },
    create: {
      shopId: params.shopId,
      supplierId: params.supplierId,
      shopifyProductId: params.shopifyProductId,
      supplierWarrantyMonths: params.supplierWarrantyMonths,
    },
    update: { supplierWarrantyMonths: params.supplierWarrantyMonths },
  });
}

export async function upsertSupplierClaim(params: {
  shopId: string;
  claimId: string;
  supplierId: string;
  amountCents?: number;
  status?: SupplierClaimStatus;
  notes?: string;
  recoverable?: boolean;
}) {
  const existing = await prisma.supplierClaim.findFirst({
    where: {
      shopId: params.shopId,
      claimId: params.claimId,
      supplierId: params.supplierId,
    },
  });

  if (existing) {
    return prisma.supplierClaim.update({
      where: { id: existing.id },
      data: {
        amountCents: params.amountCents,
        status: params.status,
        notes: params.notes,
        recoverable: params.recoverable,
      },
    });
  }

  return prisma.supplierClaim.create({
    data: {
      shopId: params.shopId,
      claimId: params.claimId,
      supplierId: params.supplierId,
      amountCents: params.amountCents,
      status: params.status ?? "NOT_FILED",
      notes: params.notes,
      recoverable: params.recoverable ?? true,
    },
  });
}

export async function ensureDefaultWorkflow(shopId: string) {
  const existing = await prisma.workflowDefinition.findFirst({
    where: { shopId, isDefault: true },
    include: { statuses: true, transitions: true },
  });
  if (existing) return existing;

  const workflow = await prisma.workflowDefinition.create({
    data: {
      shopId,
      name: "Default claim workflow",
      isDefault: true,
      active: true,
    },
  });

  const statuses: { key: string; label: string; systemState: "OPEN" | "WAITING_CUSTOMER" | "APPROVED" | "REJECTED" | "IN_RESOLUTION" | "COMPLETED" | "CANCELLED"; sortOrder: number }[] = [
    { key: "open", label: "Open", systemState: "OPEN", sortOrder: 10 },
    { key: "in_review", label: "In review", systemState: "OPEN", sortOrder: 20 },
    { key: "waiting_customer", label: "Waiting on customer", systemState: "WAITING_CUSTOMER", sortOrder: 30 },
    { key: "approved", label: "Approved", systemState: "APPROVED", sortOrder: 40 },
    { key: "in_resolution", label: "In resolution", systemState: "IN_RESOLUTION", sortOrder: 50 },
    { key: "completed", label: "Completed", systemState: "COMPLETED", sortOrder: 60 },
    { key: "rejected", label: "Rejected", systemState: "REJECTED", sortOrder: 70 },
    { key: "cancelled", label: "Cancelled", systemState: "CANCELLED", sortOrder: 80 },
  ];

  for (const s of statuses) {
    await prisma.workflowStatus.create({
      data: {
        shopId,
        workflowId: workflow.id,
        key: s.key,
        label: s.label,
        systemState: s.systemState,
        sortOrder: s.sortOrder,
        emailTemplateKey: `claim_status_${s.key}`,
      },
    });
  }

  const transitions: [string, string][] = [
    ["open", "in_review"],
    ["open", "waiting_customer"],
    ["open", "approved"],
    ["open", "rejected"],
    ["open", "cancelled"],
    ["in_review", "waiting_customer"],
    ["in_review", "approved"],
    ["in_review", "rejected"],
    ["waiting_customer", "in_review"],
    ["waiting_customer", "approved"],
    ["approved", "in_resolution"],
    ["in_resolution", "completed"],
    ["in_review", "cancelled"],
  ];

  for (const [fromKey, toKey] of transitions) {
    await prisma.workflowTransition.create({
      data: { shopId, workflowId: workflow.id, fromKey, toKey },
    });
  }

  return prisma.workflowDefinition.findUniqueOrThrow({
    where: { id: workflow.id },
    include: { statuses: { orderBy: { sortOrder: "asc" } }, transitions: true },
  });
}

export async function applyWorkflowStatus(params: {
  shopId: string;
  claimId: string;
  statusKey: string;
  note?: string;
}) {
  const workflow = await ensureDefaultWorkflow(params.shopId);
  const status = workflow.statuses.find((s) => s.key === params.statusKey);
  if (!status) throw new Error("Unknown workflow status");

  const claim = await prisma.claim.findFirst({
    where: { id: params.claimId, shopId: params.shopId },
  });
  if (!claim) throw new Error("Claim not found");

  if (claim.workflowStatusKey) {
    const allowed = workflow.transitions.some(
      (t) => t.fromKey === claim.workflowStatusKey && t.toKey === params.statusKey,
    );
    if (!allowed && claim.workflowStatusKey !== params.statusKey) {
      throw new Error(`Transition not allowed: ${claim.workflowStatusKey} → ${params.statusKey}`);
    }
  }

  // Map system state to a concrete ClaimStatus
  let claimStatus: "OPEN" | "WAITING_CUSTOMER" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "IN_RESOLUTION" | "COMPLETED" | "CANCELLED" =
    "OPEN";
  if (params.statusKey === "in_review") claimStatus = "IN_REVIEW";
  else if (status.systemState === "WAITING_CUSTOMER") claimStatus = "WAITING_CUSTOMER";
  else if (status.systemState === "APPROVED") claimStatus = "APPROVED";
  else if (status.systemState === "REJECTED") claimStatus = "REJECTED";
  else if (status.systemState === "IN_RESOLUTION") claimStatus = "IN_RESOLUTION";
  else if (status.systemState === "COMPLETED") claimStatus = "COMPLETED";
  else if (status.systemState === "CANCELLED") claimStatus = "CANCELLED";
  else claimStatus = "OPEN";

  await prisma.claim.update({
    where: { id: claim.id },
    data: {
      workflowStatusKey: params.statusKey,
      status: claimStatus,
      systemState: status.systemState,
    },
  });

  await prisma.claimNote.create({
    data: {
      shopId: params.shopId,
      claimId: claim.id,
      authorType: "system",
      body: params.note ?? `Workflow status → ${status.label}`,
      isInternal: false,
    },
  });

  return prisma.claim.findUniqueOrThrow({ where: { id: claim.id } });
}
