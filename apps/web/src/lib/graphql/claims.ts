import {
  prisma,
  createClaim,
  updateClaimStatus,
  addClaimNote,
  assignClaim,
  overrideEligibility,
  mapEligibilityLabel,
  downloadToken,
  shopRepository,
  runClaimAiAssist,
  applySuggestedClaimCategory,
  getAiCreditBalance,
} from "@aftersale/db";
import type { ClaimStatus } from "@prisma/client";
import { enqueueEmail } from "@/lib/queue";
import { resolveMerchantContext } from "@/lib/auth/merchant";

export const claimsTypeDefs = /* GraphQL */ `
  type ClaimAttachment {
    id: ID!
    fileName: String!
    contentType: String!
    sizeBytes: Int!
    scanStatus: String!
    downloadUrl: String
  }

  type ClaimNote {
    id: ID!
    authorType: String!
    authorName: String
    body: String!
    isInternal: Boolean!
    createdAt: String!
  }

  type ClaimStaff {
    id: ID!
    name: String
    email: String!
    role: String!
    active: Boolean!
    createdAt: String!
  }

  type ClaimItem {
    id: ID!
    claimNumber: String!
    publicToken: String!
    status: String!
    systemState: String!
    priority: Int!
    issueCategory: String
    issueSummary: String
    issueDetails: String
    eligibilityResult: String
    eligibilityLabel: String
    eligibilityReasons: [String!]!
    eligibilityOverride: Boolean!
    customerEmail: String
    customerName: String
    productTitle: String
    orderNumber: String
    serialNumber: String
    certificateToken: String
    assignee: ClaimStaff
    workflowStatusKey: String
    slaDueAt: String
    createdAt: String!
    updatedAt: String!
    attachments: [ClaimAttachment!]!
    notes: [ClaimNote!]!
    trackingUrl: String!
  }

  type ClaimConnection {
    nodes: [ClaimItem!]!
    total: Int!
  }

  type AiCreditBalance {
    used: Int!
    limit: Int!
    remaining: Int!
  }

  """Suggest-only AI assist for a claim. Never changes status on its own."""
  type ClaimAiAssist {
    summary: String!
    suggestedCategory: String!
    categoryConfidence: Float!
    missingInfo: [String!]!
    suggestedReply: String!
    nextSteps: [String!]!
    provider: String!
    model: String
    creditsUsed: Int!
    creditsRemaining: Int!
    creditsLimit: Int!
  }

  input CreateMerchantClaimInput {
    email: String!
    customerName: String
    warrantyId: ID
    orderNumber: String
    orderLineItemId: ID
    serialNumber: String
    issueCategory: String
    issueSummary: String!
    issueDetails: String
  }

  type MerchantOrderLineItem {
    id: ID!
    title: String!
    sku: String
    quantity: Int!
    hasWarranty: Boolean!
    warrantyId: ID
    serialNumber: String
  }

  type MerchantOrderCustomer {
    id: ID
    email: String
    name: String
  }

  type MerchantOrderOption {
    id: ID!
    orderNumber: String!
    email: String
    processedAt: String
    customer: MerchantOrderCustomer
    lineItems: [MerchantOrderLineItem!]!
  }

  extend type Query {
    claims(status: String, query: String, limit: Int, offset: Int): ClaimConnection!
    claim(id: ID!): ClaimItem
    staffMembers: [ClaimStaff!]!
    aiCreditBalance: AiCreditBalance!
    searchOrders(query: String, limit: Int): [MerchantOrderOption!]!
  }

  extend type Mutation {
    createMerchantClaim(input: CreateMerchantClaimInput!): ClaimItem!
    updateClaimStatus(id: ID!, status: String!, note: String): ClaimItem!
    addClaimNote(id: ID!, body: String!, isInternal: Boolean): ClaimNote!
    assignClaim(id: ID!, assigneeId: ID): ClaimItem!
    overrideClaimEligibility(id: ID!, reason: String!): ClaimItem!
    runClaimAiAssist(claimId: ID!): ClaimAiAssist!
    applyClaimAiCategory(claimId: ID!, category: String!): ClaimItem!
  }
`;

export const claimsQueryFields = "";
export const claimsMutationFields = "";

function appUrl() {
  return (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

export async function mapClaim(claimId: string, shopId: string, shopDomain: string) {
  const c = await prisma.claim.findFirstOrThrow({
    where: { id: claimId, shopId },
    include: {
      assignee: true,
      attachments: true,
      notes: { orderBy: { createdAt: "asc" } },
      warranty: true,
      warrantyUnit: { include: { orderLineItem: { include: { order: true } } } },
    },
  });

  const reasons = Array.isArray(c.eligibilityReasons)
    ? (c.eligibilityReasons as string[])
    : [];

  return {
    id: c.id,
    claimNumber: c.claimNumber,
    publicToken: c.publicToken,
    status: c.status,
    systemState: c.systemState,
    priority: c.priority,
    issueCategory: c.issueCategory,
    issueSummary: c.issueSummary,
    issueDetails: c.issueDetails,
    eligibilityResult: c.eligibilityResult,
    eligibilityLabel: mapEligibilityLabel(c.eligibilityResult),
    eligibilityReasons: reasons,
    eligibilityOverride: c.eligibilityOverride,
    customerEmail: c.customerEmail,
    customerName: c.customerName,
    productTitle: c.warrantyUnit?.orderLineItem.title ?? null,
    orderNumber: c.warrantyUnit?.orderLineItem.order.orderNumber ?? null,
    serialNumber: c.warrantyUnit?.serialNumber ?? null,
    certificateToken: c.warranty?.certificateToken ?? null,
    assignee: c.assignee
      ? {
          id: c.assignee.id,
          name: c.assignee.name,
          email: c.assignee.email,
          role: c.assignee.role,
          active: c.assignee.active,
          createdAt: c.assignee.createdAt.toISOString(),
        }
      : null,
    workflowStatusKey: c.workflowStatusKey,
    slaDueAt: c.slaDueAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    attachments: c.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
      scanStatus: a.scanStatus,
      downloadUrl: `${appUrl()}/api/public/attachments/${downloadToken(a.id, shopId)}`,
    })),
    notes: c.notes.map((n) => ({
      id: n.id,
      authorType: n.authorType,
      authorName: n.authorName,
      body: n.body,
      isInternal: n.isInternal,
      createdAt: n.createdAt.toISOString(),
    })),
    trackingUrl: `https://${shopDomain}/apps/aftersale/claim/${c.publicToken}`,
  };
}

async function notifyClaimStatus(shopId: string, claimId: string, status: string) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, shopId },
    include: { shop: true },
  });
  if (!claim?.customerEmail) return;
  const appBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://aftersale.tidyflowapp.com").replace(
    /\/$/,
    "",
  );
  await enqueueEmail({
    shopId,
    to: claim.customerEmail,
    template: `claim_status_${status.toLowerCase()}`,
    data: {
      claimNumber: claim.claimNumber,
      status,
      trackingUrl: `${appBase}/apps/aftersale/claim/${claim.publicToken}?shop=${encodeURIComponent(claim.shop.shopDomain)}`,
      summary: claim.issueSummary,
      shopName: claim.shop.shopName ?? claim.shop.shopDomain,
    },
  });
}

export const claimsResolvers = {
  Query: {
    claims: async (
      _: unknown,
      args: { status?: string; query?: string; limit?: number; offset?: number },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const shop = await shopRepository.findByDomain(merchant.shopDomain);
      const limit = Math.min(args.limit ?? 50, 100);
      const offset = args.offset ?? 0;
      const where: Record<string, unknown> = { shopId: merchant.shopId };
      if (args.status) where.status = args.status;
      if (args.query) {
        const q = args.query.trim();
        where.OR = [
          { claimNumber: { contains: q, mode: "insensitive" } },
          { customerEmail: { contains: q, mode: "insensitive" } },
          { issueSummary: { contains: q, mode: "insensitive" } },
        ];
      }
      const [rows, total] = await Promise.all([
        prisma.claim.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: { id: true },
        }),
        prisma.claim.count({ where }),
      ]);
      const nodes = await Promise.all(
        rows.map((r) => mapClaim(r.id, merchant.shopId, shop?.shopDomain ?? merchant.shopDomain)),
      );
      return { nodes, total };
    },
    claim: async (_: unknown, args: { id: string }, ctx: { request: Request }) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const exists = await prisma.claim.findFirst({
        where: { id: args.id, shopId: merchant.shopId },
      });
      if (!exists) return null;
      return mapClaim(args.id, merchant.shopId, merchant.shopDomain);
    },
    staffMembers: async (_: unknown, __: unknown, ctx: { request: Request }) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const staff = await prisma.staffMember.findMany({
        where: { shopId: merchant.shopId },
        orderBy: [{ active: "desc" }, { email: "asc" }],
      });
      return staff.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
        active: s.active,
        createdAt: s.createdAt.toISOString(),
      }));
    },
    aiCreditBalance: async (_: unknown, __: unknown, ctx: { request: Request }) => {
      const merchant = await resolveMerchantContext(ctx.request);
      return getAiCreditBalance(merchant.shopId);
    },
    searchOrders: async (
      _: unknown,
      args: { query?: string; limit?: number },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const limit = Math.min(args.limit ?? 20, 40);
      const q = (args.query ?? "").trim();
      const where: Record<string, unknown> = { shopId: merchant.shopId };
      if (q) {
        where.OR = [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { customer: { email: { contains: q, mode: "insensitive" } } },
          {
            customer: {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        ];
      }
      const orders = await prisma.order.findMany({
        where,
        orderBy: { processedAt: "desc" },
        take: limit,
        include: {
          customer: true,
          lineItems: {
            include: {
              warrantyUnits: {
                include: {
                  warranties: {
                    where: { status: { not: "VOID" } },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
                take: 1,
              },
            },
          },
        },
      });
      return orders.map((o) => {
        const name = o.customer
          ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(" ") || null
          : null;
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          email: o.email ?? o.customer?.email ?? null,
          processedAt: o.processedAt?.toISOString() ?? o.createdAt.toISOString(),
          customer: {
            id: o.customer?.id ?? null,
            email: o.email ?? o.customer?.email ?? null,
            name,
          },
          lineItems: o.lineItems.map((li) => {
            const unit = li.warrantyUnits[0];
            const warranty = unit?.warranties[0];
            return {
              id: li.id,
              title: li.title,
              sku: li.sku,
              quantity: li.quantity,
              hasWarranty: Boolean(warranty),
              warrantyId: warranty?.id ?? null,
              serialNumber: unit?.serialNumber ?? null,
            };
          }),
        };
      });
    },
  },
  Mutation: {
    createMerchantClaim: async (
      _: unknown,
      args: {
        input: {
          email: string;
          customerName?: string;
          warrantyId?: string;
          orderNumber?: string;
          orderLineItemId?: string;
          serialNumber?: string;
          issueCategory?: string;
          issueSummary: string;
          issueDetails?: string;
        };
      },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const { claim } = await createClaim({
        shopId: merchant.shopId,
        email: args.input.email,
        customerName: args.input.customerName,
        warrantyId: args.input.warrantyId,
        orderNumber: args.input.orderNumber,
        orderLineItemId: args.input.orderLineItemId,
        serialNumber: args.input.serialNumber,
        issueCategory: args.input.issueCategory,
        issueSummary: args.input.issueSummary,
        issueDetails: args.input.issueDetails,
      });
      const appBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://aftersale.tidyflowapp.com").replace(
        /\/$/,
        "",
      );
      await enqueueEmail({
        shopId: merchant.shopId,
        to: args.input.email,
        template: "claim_created",
        data: {
          claimNumber: claim.claimNumber,
          trackingUrl: `${appBase}/apps/aftersale/claim/${claim.publicToken}?shop=${encodeURIComponent(merchant.shopDomain)}`,
          shopName: merchant.shopDomain,
        },
      });
      return mapClaim(claim.id, merchant.shopId, merchant.shopDomain);
    },
    updateClaimStatus: async (
      _: unknown,
      args: { id: string; status: string; note?: string },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      await updateClaimStatus({
        shopId: merchant.shopId,
        claimId: args.id,
        status: args.status as ClaimStatus,
        note: args.note,
      });
      await notifyClaimStatus(merchant.shopId, args.id, args.status);
      return mapClaim(args.id, merchant.shopId, merchant.shopDomain);
    },
    addClaimNote: async (
      _: unknown,
      args: { id: string; body: string; isInternal?: boolean },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      const note = await addClaimNote({
        shopId: merchant.shopId,
        claimId: args.id,
        body: args.body,
        isInternal: args.isInternal ?? false,
        authorType: "staff",
      });
      return {
        id: note.id,
        authorType: note.authorType,
        authorName: note.authorName,
        body: note.body,
        isInternal: note.isInternal,
        createdAt: note.createdAt.toISOString(),
      };
    },
    assignClaim: async (
      _: unknown,
      args: { id: string; assigneeId?: string | null },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      await assignClaim({
        shopId: merchant.shopId,
        claimId: args.id,
        assigneeId: args.assigneeId ?? null,
      });
      return mapClaim(args.id, merchant.shopId, merchant.shopDomain);
    },
    overrideClaimEligibility: async (
      _: unknown,
      args: { id: string; reason: string },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      await overrideEligibility({
        shopId: merchant.shopId,
        claimId: args.id,
        reason: args.reason,
      });
      return mapClaim(args.id, merchant.shopId, merchant.shopDomain);
    },
    runClaimAiAssist: async (
      _: unknown,
      args: { claimId: string },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      return runClaimAiAssist({
        shopId: merchant.shopId,
        claimId: args.claimId,
      });
    },
    applyClaimAiCategory: async (
      _: unknown,
      args: { claimId: string; category: string },
      ctx: { request: Request },
    ) => {
      const merchant = await resolveMerchantContext(ctx.request);
      await applySuggestedClaimCategory({
        shopId: merchant.shopId,
        claimId: args.claimId,
        category: args.category,
      });
      return mapClaim(args.claimId, merchant.shopId, merchant.shopDomain);
    },
  },
};
