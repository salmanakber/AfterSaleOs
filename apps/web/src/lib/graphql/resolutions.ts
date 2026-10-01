import {
  prisma,
  createRepair,
  updateRepair,
  recordReplacement,
  completeReplacementWarranty,
  recordRefund,
  createSupplier,
  linkProductSupplier,
  upsertSupplierClaim,
  ensureDefaultWorkflow,
  applyWorkflowStatus,
} from "@aftersale/db";
import type { RepairStatus, ReplacementWarrantyMode, SupplierClaimStatus } from "@prisma/client";
import { resolveMerchantContext } from "@/lib/auth/merchant";
import { shopifyGraphqlRequest } from "@/lib/shopify/client";
import { enqueueEmail } from "@/lib/queue";
import { mapClaim } from "./claims";

export const resolutionsTypeDefs = /* GraphQL */ `
  type RepairItem {
    id: ID!
    repairNumber: String!
    claimId: ID!
    claimNumber: String
    status: String!
    diagnosis: String
    notes: String
    repairCostCents: Int
    currency: String!
    shippingIn: String
    shippingOut: String
    technician: ClaimStaff
    completedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type ReplacementItem {
    id: ID!
    claimId: ID!
    claimNumber: String
    status: String!
    shopifyDraftOrderId: String
    shopifyDraftOrderName: String
    shopifyOrderId: String
    variantId: String
    productTitle: String
    warrantyMode: String!
    adminOrderUrl: String
    createdAt: String!
  }

  type ResolutionItem {
    id: ID!
    claimId: ID!
    claimNumber: String
    type: String!
    amountCents: Int
    currency: String!
    reason: String
    shopifyRefundId: String
    shopifyOrderId: String
    adminDeepLink: String
    issuedInShopify: Boolean!
    createdAt: String!
  }

  type SupplierItem {
    id: ID!
    name: String!
    email: String
    phone: String
    notes: String
    active: Boolean!
    productCount: Int!
    claimCount: Int!
    createdAt: String!
  }

  type SupplierClaimItem {
    id: ID!
    claimId: ID!
    claimNumber: String
    supplierId: ID!
    supplierName: String!
    recoverable: Boolean!
    amountCents: Int
    currency: String!
    status: String!
    notes: String
    createdAt: String!
  }

  type WorkflowStatusItem {
    id: ID!
    key: String!
    label: String!
    systemState: String!
    sortOrder: Int!
    emailTemplateKey: String
  }

  type WorkflowTransitionItem {
    id: ID!
    fromKey: String!
    toKey: String!
  }

  type WorkflowItem {
    id: ID!
    name: String!
    isDefault: Boolean!
    active: Boolean!
    statuses: [WorkflowStatusItem!]!
    transitions: [WorkflowTransitionItem!]!
  }

  type ProductSupplierLink {
    id: ID!
    shopifyProductId: String!
    productTitle: String
    supplierId: ID!
    supplierName: String!
    supplierWarrantyMonths: Int
  }

  input CreateRepairInput {
    claimId: ID!
    technicianId: ID
    notes: String
  }

  input UpdateRepairInput {
    status: String
    diagnosis: String
    notes: String
    repairCostCents: Int
    shippingIn: String
    shippingOut: String
    technicianId: ID
  }

  input CreateReplacementInput {
    claimId: ID!
    variantId: String
    productTitle: String
    quantity: Int
    warrantyMode: String
  }

  input RecordRefundInput {
    claimId: ID!
    amountCents: Int!
    currency: String
    reason: String
    shopifyOrderId: String
    shopifyRefundId: String
    issuedInShopify: Boolean
    adminDeepLink: String
  }

  input CreateSupplierInput {
    name: String!
    email: String
    phone: String
    notes: String
  }

  input UpsertSupplierClaimInput {
    claimId: ID!
    supplierId: ID!
    amountCents: Int
    status: String
    notes: String
    recoverable: Boolean
  }

  extend type Query {
    repairs(status: String, limit: Int): [RepairItem!]!
    repair(id: ID!): RepairItem
    replacements(limit: Int): [ReplacementItem!]!
    resolutions(type: String, limit: Int): [ResolutionItem!]!
    suppliers(activeOnly: Boolean): [SupplierItem!]!
    supplierClaims(supplierId: ID, status: String, limit: Int): [SupplierClaimItem!]!
    productSupplierLinks(supplierId: ID): [ProductSupplierLink!]!
    claimWorkflow: WorkflowItem!
  }

  extend type Mutation {
    createRepair(input: CreateRepairInput!): RepairItem!
    updateRepair(id: ID!, input: UpdateRepairInput!): RepairItem!
    createReplacementDraftOrder(input: CreateReplacementInput!): ReplacementItem!
    completeReplacement(id: ID!, shopifyOrderId: String): ReplacementItem!
    recordRefund(input: RecordRefundInput!): ResolutionItem!
    createSupplier(input: CreateSupplierInput!): SupplierItem!
    linkProductSupplier(supplierId: ID!, shopifyProductId: String!, supplierWarrantyMonths: Int): ProductSupplierLink!
    upsertSupplierClaim(input: UpsertSupplierClaimInput!): SupplierClaimItem!
    applyClaimWorkflowStatus(claimId: ID!, statusKey: String!, note: String): ClaimItem!
  }
`;

function mapRepair(
  r: {
    id: string;
    repairNumber: string;
    claimId: string;
    status: string;
    diagnosis: string | null;
    notes: string | null;
    repairCostCents: number | null;
    currency: string;
    shippingIn: string | null;
    shippingOut: string | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    technician: { id: string; name: string | null; email: string } | null;
    claim?: { claimNumber: string } | null;
  },
) {
  return {
    id: r.id,
    repairNumber: r.repairNumber,
    claimId: r.claimId,
    claimNumber: r.claim?.claimNumber ?? null,
    status: r.status,
    diagnosis: r.diagnosis,
    notes: r.notes,
    repairCostCents: r.repairCostCents,
    currency: r.currency,
    shippingIn: r.shippingIn,
    shippingOut: r.shippingOut,
    technician: r.technician
      ? { id: r.technician.id, name: r.technician.name, email: r.technician.email }
      : null,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const repairInclude = {
  technician: true,
  claim: { select: { claimNumber: true } },
} as const;

async function notifyRepairStatus(shopId: string, repairId: string) {
  const repair = await prisma.repair.findFirst({
    where: { id: repairId, shopId },
    include: { claim: { include: { shop: true } } },
  });
  if (!repair?.claim.customerEmail) return;
  await enqueueEmail({
    shopId,
    to: repair.claim.customerEmail,
    template: `repair_status_${repair.status.toLowerCase()}`,
    data: {
      claimNumber: repair.claim.claimNumber,
      repairNumber: repair.repairNumber,
      status: repair.status,
      trackingUrl: `https://${repair.claim.shop.shopDomain}/apps/aftersale/claim/${repair.claim.publicToken}`,
      shopName: repair.claim.shop.shopName ?? repair.claim.shop.shopDomain,
    },
  });
}

export const resolutionsResolvers = {
  Query: {
    repairs: async (
      _: unknown,
      args: { status?: string; limit?: number },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const rows = await prisma.repair.findMany({
        where: {
          shopId: merchant.shopId,
          ...(args.status ? { status: args.status as RepairStatus } : {}),
        },
        include: repairInclude,
        orderBy: { updatedAt: "desc" },
        take: Math.min(args.limit ?? 100, 200),
      });
      return rows.map(mapRepair);
    },
    repair: async (_: unknown, args: { id: string }, ctx: { request: Request }) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const row = await prisma.repair.findFirst({
        where: { id: args.id, shopId: merchant.shopId },
        include: repairInclude,
      });
      return row ? mapRepair(row) : null;
    },
    replacements: async (
      _: unknown,
      args: { limit?: number },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const rows = await prisma.replacement.findMany({
        where: { shopId: merchant.shopId },
        include: { claim: { select: { claimNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.min(args.limit ?? 100, 200),
      });
      return rows.map((r) => ({
        id: r.id,
        claimId: r.claimId,
        claimNumber: r.claim.claimNumber,
        status: r.status,
        shopifyDraftOrderId: r.shopifyDraftOrderId,
        shopifyDraftOrderName: r.shopifyDraftOrderName,
        shopifyOrderId: r.shopifyOrderId,
        variantId: r.variantId,
        productTitle: r.productTitle,
        warrantyMode: r.warrantyMode,
        adminOrderUrl: r.adminOrderUrl,
        createdAt: r.createdAt.toISOString(),
      }));
    },
    resolutions: async (
      _: unknown,
      args: { type?: string; limit?: number },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const rows = await prisma.resolution.findMany({
        where: {
          shopId: merchant.shopId,
          ...(args.type ? { type: args.type as never } : {}),
        },
        include: { claim: { select: { claimNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.min(args.limit ?? 100, 200),
      });
      return rows.map((r) => ({
        id: r.id,
        claimId: r.claimId,
        claimNumber: r.claim.claimNumber,
        type: r.type,
        amountCents: r.amountCents,
        currency: r.currency,
        reason: r.reason,
        shopifyRefundId: r.shopifyRefundId,
        shopifyOrderId: r.shopifyOrderId,
        adminDeepLink: r.adminDeepLink,
        issuedInShopify: r.issuedInShopify,
        createdAt: r.createdAt.toISOString(),
      }));
    },
    suppliers: async (
      _: unknown,
      args: { activeOnly?: boolean },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const rows = await prisma.supplier.findMany({
        where: {
          shopId: merchant.shopId,
          ...(args.activeOnly === false ? {} : { active: true }),
        },
        include: { _count: { select: { products: true, claims: true } } },
        orderBy: { name: "asc" },
      });
      return rows.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        notes: s.notes,
        active: s.active,
        productCount: s._count.products,
        claimCount: s._count.claims,
        createdAt: s.createdAt.toISOString(),
      }));
    },
    supplierClaims: async (
      _: unknown,
      args: { supplierId?: string; status?: string; limit?: number },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const rows = await prisma.supplierClaim.findMany({
        where: {
          shopId: merchant.shopId,
          ...(args.supplierId ? { supplierId: args.supplierId } : {}),
          ...(args.status ? { status: args.status as SupplierClaimStatus } : {}),
        },
        include: {
          supplier: true,
          claim: { select: { claimNumber: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: Math.min(args.limit ?? 100, 200),
      });
      return rows.map((r) => ({
        id: r.id,
        claimId: r.claimId,
        claimNumber: r.claim.claimNumber,
        supplierId: r.supplierId,
        supplierName: r.supplier.name,
        recoverable: r.recoverable,
        amountCents: r.amountCents,
        currency: r.currency,
        status: r.status,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
      }));
    },
    productSupplierLinks: async (
      _: unknown,
      args: { supplierId?: string },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const rows = await prisma.productSupplier.findMany({
        where: {
          shopId: merchant.shopId,
          ...(args.supplierId ? { supplierId: args.supplierId } : {}),
        },
        include: { supplier: true },
        orderBy: { shopifyProductId: "asc" },
      });
      const productIds = [...new Set(rows.map((r) => r.shopifyProductId))];
      const products = await prisma.product.findMany({
        where: { shopId: merchant.shopId, shopifyProductId: { in: productIds } },
      });
      const titleById = new Map(products.map((p) => [p.shopifyProductId, p.title]));
      return rows.map((r) => ({
        id: r.id,
        shopifyProductId: r.shopifyProductId,
        productTitle: titleById.get(r.shopifyProductId) ?? null,
        supplierId: r.supplierId,
        supplierName: r.supplier.name,
        supplierWarrantyMonths: r.supplierWarrantyMonths,
      }));
    },
    claimWorkflow: async (_: unknown, __: unknown, ctx: { request: Request }) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const wf = await ensureDefaultWorkflow(merchant.shopId);
      return {
        id: wf.id,
        name: wf.name,
        isDefault: wf.isDefault,
        active: wf.active,
        statuses: wf.statuses.map((s) => ({
          id: s.id,
          key: s.key,
          label: s.label,
          systemState: s.systemState,
          sortOrder: s.sortOrder,
          emailTemplateKey: s.emailTemplateKey,
        })),
        transitions: wf.transitions.map((t) => ({
          id: t.id,
          fromKey: t.fromKey,
          toKey: t.toKey,
        })),
      };
    },
  },
  Mutation: {
    createRepair: async (
      _: unknown,
      args: { input: { claimId: string; technicianId?: string; notes?: string } },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const repair = await createRepair({
        shopId: merchant.shopId,
        claimId: args.input.claimId,
        technicianId: args.input.technicianId,
        notes: args.input.notes,
      });
      const full = await prisma.repair.findFirstOrThrow({
        where: { id: repair.id },
        include: repairInclude,
      });
      await notifyRepairStatus(merchant.shopId, repair.id);
      return mapRepair(full);
    },
    updateRepair: async (
      _: unknown,
      args: {
        id: string;
        input: {
          status?: string;
          diagnosis?: string;
          notes?: string;
          repairCostCents?: number;
          shippingIn?: string;
          shippingOut?: string;
          technicianId?: string | null;
        };
      },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      await updateRepair({
        shopId: merchant.shopId,
        repairId: args.id,
        status: args.input.status as RepairStatus | undefined,
        diagnosis: args.input.diagnosis,
        notes: args.input.notes,
        repairCostCents: args.input.repairCostCents,
        shippingIn: args.input.shippingIn,
        shippingOut: args.input.shippingOut,
        technicianId: args.input.technicianId,
      });
      const full = await prisma.repair.findFirstOrThrow({
        where: { id: args.id, shopId: merchant.shopId },
        include: repairInclude,
      });
      if (args.input.status) await notifyRepairStatus(merchant.shopId, args.id);
      return mapRepair(full);
    },
    createReplacementDraftOrder: async (
      _: unknown,
      args: {
        input: {
          claimId: string;
          variantId?: string;
          productTitle?: string;
          quantity?: number;
          warrantyMode?: string;
        };
      },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const claim = await prisma.claim.findFirst({
        where: { id: args.input.claimId, shopId: merchant.shopId },
        include: {
          warrantyUnit: { include: { orderLineItem: true } },
        },
      });
      if (!claim) throw new Error("Claim not found");

      const variantId =
        args.input.variantId ??
        claim.warrantyUnit?.orderLineItem.shopifyVariantId ??
        null;
      const productTitle =
        args.input.productTitle ??
        claim.warrantyUnit?.orderLineItem.title ??
        "Replacement item";
      const quantity = args.input.quantity ?? 1;

      let draftOrderId: string | undefined;
      let draftOrderName: string | undefined;
      let adminOrderUrl: string | undefined;

      if (variantId) {
        const gid = variantId.startsWith("gid://")
          ? variantId
          : `gid://shopify/ProductVariant/${variantId}`;
        const data = await shopifyGraphqlRequest<{
          draftOrderCreate: {
            draftOrder: { id: string; name: string; legacyResourceId: string } | null;
            userErrors: { message: string }[];
          };
        }>(
          merchant.shopDomain,
          `#graphql
          mutation CreateDraft($input: DraftOrderInput!) {
            draftOrderCreate(input: $input) {
              draftOrder { id name legacyResourceId }
              userErrors { message }
            }
          }`,
          {
            input: {
              email: claim.customerEmail ?? undefined,
              note: `AfterSale OS replacement for claim ${claim.claimNumber}`,
              tags: ["aftersale-replacement", claim.claimNumber],
              lineItems: [
                {
                  variantId: gid,
                  quantity,
                  appliedDiscount: {
                    value: 100,
                    valueType: "PERCENTAGE",
                    title: "Warranty replacement",
                  },
                },
              ],
              customAttributes: [
                { key: "aftersale_claim_id", value: claim.id },
                { key: "aftersale_claim_number", value: claim.claimNumber },
              ],
            },
          },
        );

        if (data.draftOrderCreate.userErrors?.length) {
          throw new Error(data.draftOrderCreate.userErrors.map((e) => e.message).join("; "));
        }
        const draft = data.draftOrderCreate.draftOrder;
        if (!draft) throw new Error("Draft order creation failed");
        draftOrderId = draft.id;
        draftOrderName = draft.name;
        adminOrderUrl = `https://${merchant.shopDomain}/admin/draft_orders/${draft.legacyResourceId}`;
      }

      const replacement = await recordReplacement({
        shopId: merchant.shopId,
        claimId: claim.id,
        shopifyDraftOrderId: draftOrderId,
        shopifyDraftOrderName: draftOrderName,
        variantId: variantId ?? undefined,
        productTitle,
        warrantyMode: (args.input.warrantyMode as ReplacementWarrantyMode) ?? "INHERIT_REMAINING",
        adminOrderUrl,
      });

      return {
        id: replacement.id,
        claimId: replacement.claimId,
        claimNumber: claim.claimNumber,
        status: replacement.status,
        shopifyDraftOrderId: replacement.shopifyDraftOrderId,
        shopifyDraftOrderName: replacement.shopifyDraftOrderName,
        shopifyOrderId: replacement.shopifyOrderId,
        variantId: replacement.variantId,
        productTitle: replacement.productTitle,
        warrantyMode: replacement.warrantyMode,
        adminOrderUrl: replacement.adminOrderUrl,
        createdAt: replacement.createdAt.toISOString(),
      };
    },
    completeReplacement: async (
      _: unknown,
      args: { id: string; shopifyOrderId?: string },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const updated = await completeReplacementWarranty({
        shopId: merchant.shopId,
        replacementId: args.id,
        shopifyOrderId: args.shopifyOrderId,
      });
      const claim = await prisma.claim.findFirst({
        where: { id: updated.claimId, shopId: merchant.shopId },
      });
      return {
        id: updated.id,
        claimId: updated.claimId,
        claimNumber: claim?.claimNumber ?? null,
        status: updated.status,
        shopifyDraftOrderId: updated.shopifyDraftOrderId,
        shopifyDraftOrderName: updated.shopifyDraftOrderName,
        shopifyOrderId: updated.shopifyOrderId,
        variantId: updated.variantId,
        productTitle: updated.productTitle,
        warrantyMode: updated.warrantyMode,
        adminOrderUrl: updated.adminOrderUrl,
        createdAt: updated.createdAt.toISOString(),
      };
    },
    recordRefund: async (
      _: unknown,
      args: {
        input: {
          claimId: string;
          amountCents: number;
          currency?: string;
          reason?: string;
          shopifyOrderId?: string;
          shopifyRefundId?: string;
          issuedInShopify?: boolean;
          adminDeepLink?: string;
        };
      },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      let adminDeepLink = args.input.adminDeepLink;
      if (!adminDeepLink && args.input.shopifyOrderId) {
        const oid = args.input.shopifyOrderId.replace(/\D/g, "");
        if (oid) {
          adminDeepLink = `https://${merchant.shopDomain}/admin/orders/${oid}`;
        }
      }
      const resolution = await recordRefund({
        shopId: merchant.shopId,
        claimId: args.input.claimId,
        amountCents: args.input.amountCents,
        currency: args.input.currency,
        reason: args.input.reason,
        shopifyOrderId: args.input.shopifyOrderId,
        shopifyRefundId: args.input.shopifyRefundId,
        issuedInShopify: args.input.issuedInShopify,
        adminDeepLink,
      });
      const claim = await prisma.claim.findFirst({
        where: { id: resolution.claimId, shopId: merchant.shopId },
      });
      return {
        id: resolution.id,
        claimId: resolution.claimId,
        claimNumber: claim?.claimNumber ?? null,
        type: resolution.type,
        amountCents: resolution.amountCents,
        currency: resolution.currency,
        reason: resolution.reason,
        shopifyRefundId: resolution.shopifyRefundId,
        shopifyOrderId: resolution.shopifyOrderId,
        adminDeepLink: resolution.adminDeepLink,
        issuedInShopify: resolution.issuedInShopify,
        createdAt: resolution.createdAt.toISOString(),
      };
    },
    createSupplier: async (
      _: unknown,
      args: { input: { name: string; email?: string; phone?: string; notes?: string } },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const s = await createSupplier({
        shopId: merchant.shopId,
        name: args.input.name,
        email: args.input.email,
        phone: args.input.phone,
        notes: args.input.notes,
      });
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        notes: s.notes,
        active: s.active,
        productCount: 0,
        claimCount: 0,
        createdAt: s.createdAt.toISOString(),
      };
    },
    linkProductSupplier: async (
      _: unknown,
      args: { supplierId: string; shopifyProductId: string; supplierWarrantyMonths?: number },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const link = await linkProductSupplier({
        shopId: merchant.shopId,
        supplierId: args.supplierId,
        shopifyProductId: args.shopifyProductId,
        supplierWarrantyMonths: args.supplierWarrantyMonths,
      });
      const supplier = await prisma.supplier.findFirstOrThrow({
        where: { id: link.supplierId, shopId: merchant.shopId },
      });
      const product = await prisma.product.findFirst({
        where: { shopId: merchant.shopId, shopifyProductId: link.shopifyProductId },
      });
      return {
        id: link.id,
        shopifyProductId: link.shopifyProductId,
        productTitle: product?.title ?? null,
        supplierId: link.supplierId,
        supplierName: supplier.name,
        supplierWarrantyMonths: link.supplierWarrantyMonths,
      };
    },
    upsertSupplierClaim: async (
      _: unknown,
      args: {
        input: {
          claimId: string;
          supplierId: string;
          amountCents?: number;
          status?: string;
          notes?: string;
          recoverable?: boolean;
        };
      },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const row = await upsertSupplierClaim({
        shopId: merchant.shopId,
        claimId: args.input.claimId,
        supplierId: args.input.supplierId,
        amountCents: args.input.amountCents,
        status: args.input.status as SupplierClaimStatus | undefined,
        notes: args.input.notes,
        recoverable: args.input.recoverable,
      });
      const full = await prisma.supplierClaim.findFirstOrThrow({
        where: { id: row.id },
        include: { supplier: true, claim: { select: { claimNumber: true } } },
      });
      return {
        id: full.id,
        claimId: full.claimId,
        claimNumber: full.claim.claimNumber,
        supplierId: full.supplierId,
        supplierName: full.supplier.name,
        recoverable: full.recoverable,
        amountCents: full.amountCents,
        currency: full.currency,
        status: full.status,
        notes: full.notes,
        createdAt: full.createdAt.toISOString(),
      };
    },
    applyClaimWorkflowStatus: async (
      _: unknown,
      args: { claimId: string; statusKey: string; note?: string },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      await applyWorkflowStatus({
        shopId: merchant.shopId,
        claimId: args.claimId,
        statusKey: args.statusKey,
        note: args.note,
      });
      return mapClaim(args.claimId, merchant.shopId, merchant.shopDomain);
    },
  },
};
