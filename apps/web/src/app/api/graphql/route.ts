import { createSchema, createYoga } from "graphql-yoga";
import {
  prisma,
  usageRepository,
  listWarrantyRules,
  createWarrantyRule,
  publishRuleVersion,
  updateRuleMeta,
  getWarrantyRule,
  createManualWarranty,
} from "@aftersale/db";
import {
  resolveMerchantContext,
  SessionTokenStaleError,
} from "@/lib/auth/merchant";
import { enqueueBackfill } from "@/lib/queue";

export const runtime = "nodejs";

const typeDefs = /* GraphQL */ `
  type Plan {
    id: ID!
    name: String!
    slug: String!
    priceMonthlyCents: Int!
    warrantiesPerMonth: Int!
    claimsPerMonth: Int!
    aiCreditsPerMonth: Int!
  }

  type UsageMeter {
    metric: String!
    used: Int!
    limit: Int!
  }

  type ShopSummary {
    id: ID!
    shopDomain: String!
    shopName: String
    status: String!
    onboardingCompleted: Boolean!
    voidWarrantyOnRefund: Boolean!
    timezone: String!
    plan: Plan
    usage: [UsageMeter!]!
  }

  type HomeKpis {
    openClaims: Int!
    awaitingAction: Int!
    activeWarranties: Int!
    expiringThisMonth: Int!
    claimRate30d: Float!
  }

  type AttentionItem {
    id: ID!
    type: String!
    title: String!
    href: String
  }

  type HomeDashboard {
    shop: ShopSummary!
    kpis: HomeKpis!
    needsAttention: [AttentionItem!]!
    setupChecklist: [AttentionItem!]!
  }

  type RuleAssignment {
    id: ID!
    targetType: String!
    targetId: String
  }

  type WarrantyRuleVersion {
    id: ID!
    version: Int!
    warrantyType: String!
    durationMonths: Int
    startDateRule: String!
    serialMode: String!
    gracePeriodDays: Int!
    termsHtml: String
  }

  type WarrantyRule {
    id: ID!
    name: String!
    priority: Int!
    active: Boolean!
    currentVersionId: String
    currentVersion: WarrantyRuleVersion
    assignments: [RuleAssignment!]!
    versions: [WarrantyRuleVersion!]!
  }

  type WarrantyUnit {
    id: ID!
    unitIndex: Int!
    serialNumber: String
    status: String!
  }

  type Warranty {
    id: ID!
    status: String!
    source: String!
    startAt: String
    endAt: String
    certificateToken: String!
    voidReason: String
    customerEmail: String
    productTitle: String
    orderNumber: String
    serialNumber: String
    ruleName: String
    warrantyType: String
    unit: WarrantyUnit
  }

  type WarrantyConnection {
    nodes: [Warranty!]!
    total: Int!
  }

  type ProductCoverage {
    id: ID!
    title: String!
    shopifyProductId: String!
    imageUrl: String
    coverageLabel: String!
  }

  type JobStatus {
    id: ID!
    type: String!
    status: String!
    progress: Int!
    total: Int!
    errorSummary: String
    result: String
    createdAt: String!
  }

  input RuleVersionInput {
    warrantyType: String!
    durationMonths: Int
    startDateRule: String!
    serialMode: String!
    gracePeriodDays: Int
    termsHtml: String
  }

  input RuleAssignmentInput {
    targetType: String!
    targetId: String
  }

  input CreateRuleInput {
    name: String!
    priority: Int
    version: RuleVersionInput!
    assignments: [RuleAssignmentInput!]!
  }

  input ManualWarrantyInput {
    customerEmail: String
    productTitle: String!
    shopifyProductId: String
    shopifyVariantId: String
    serialNumber: String
    ruleId: ID!
    purchaseAt: String!
    startAt: String
    reason: String!
  }

  type Query {
    health: String!
    home: HomeDashboard!
    warrantyRules: [WarrantyRule!]!
    warrantyRule(id: ID!): WarrantyRule
    warranties(query: String, status: String, limit: Int, offset: Int): WarrantyConnection!
    warranty(id: ID!): Warranty
    products(limit: Int): [ProductCoverage!]!
    jobs(type: String, limit: Int): [JobStatus!]!
  }

  type Mutation {
    completeOnboardingStep(step: String!): ShopSummary!
    createWarrantyRule(input: CreateRuleInput!): WarrantyRule!
    updateWarrantyRule(id: ID!, name: String, priority: Int, active: Boolean, assignments: [RuleAssignmentInput!]): WarrantyRule!
    publishWarrantyRuleVersion(id: ID!, version: RuleVersionInput!): WarrantyRule!
    createManualWarranty(input: ManualWarrantyInput!): Warranty!
    voidWarranty(id: ID!, reason: String!): Warranty!
    extendWarranty(id: ID!, extraMonths: Int!, reason: String!): Warranty!
    startBackfill(lookbackMonths: Int!): JobStatus!
    updateShopSettings(voidWarrantyOnRefund: Boolean, timezone: String): ShopSummary!
  }
`;

function mapRule(rule: NonNullable<Awaited<ReturnType<typeof getWarrantyRule>>>) {
  const current =
    (rule.currentVersionId
      ? rule.versions.find((v) => v.id === rule.currentVersionId)
      : null) ?? rule.versions[0] ?? null;
  return {
    ...rule,
    currentVersion: current,
  };
}

async function shopSummary(shopId: string) {
  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
    include: { plan: true },
  });
  const plan = shop.plan;
  return {
    id: shop.id,
    shopDomain: shop.shopDomain,
    shopName: shop.shopName,
    status: shop.status,
    onboardingCompleted: shop.onboardingCompleted,
    voidWarrantyOnRefund: shop.voidWarrantyOnRefund,
    timezone: shop.timezone,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          priceMonthlyCents: plan.priceMonthlyCents,
          warrantiesPerMonth: plan.warrantiesPerMonth,
          claimsPerMonth: plan.claimsPerMonth,
          aiCreditsPerMonth: plan.aiCreditsPerMonth,
        }
      : null,
    usage: [
      {
        metric: "warranties_created",
        used: await usageRepository.getCount(shop.id, "warranties_created"),
        limit: plan?.warrantiesPerMonth ?? 50,
      },
      {
        metric: "claims_created",
        used: await usageRepository.getCount(shop.id, "claims_created"),
        limit: plan?.claimsPerMonth ?? 10,
      },
      {
        metric: "ai_credits",
        used: await usageRepository.getCount(shop.id, "ai_credits"),
        limit: plan?.aiCreditsPerMonth ?? 10,
      },
    ],
  };
}

async function mapWarranty(w: {
  id: string;
  status: string;
  source: string;
  startAt: Date | null;
  endAt: Date | null;
  certificateToken: string;
  voidReason: string | null;
  customer: { email: string | null } | null;
  ruleVersion: { warrantyType: string; rule: { name: string } };
  warrantyUnit: {
    id: string;
    unitIndex: number;
    serialNumber: string | null;
    status: string;
    orderLineItem: { title: string; order: { orderNumber: string } };
  };
}) {
  return {
    id: w.id,
    status: w.status,
    source: w.source,
    startAt: w.startAt?.toISOString() ?? null,
    endAt: w.endAt?.toISOString() ?? null,
    certificateToken: w.certificateToken,
    voidReason: w.voidReason,
    customerEmail: w.customer?.email ?? null,
    productTitle: w.warrantyUnit.orderLineItem.title,
    orderNumber: w.warrantyUnit.orderLineItem.order.orderNumber,
    serialNumber: w.warrantyUnit.serialNumber,
    ruleName: w.ruleVersion.rule.name,
    warrantyType: w.ruleVersion.warrantyType,
    unit: {
      id: w.warrantyUnit.id,
      unitIndex: w.warrantyUnit.unitIndex,
      serialNumber: w.warrantyUnit.serialNumber,
      status: w.warrantyUnit.status,
    },
  };
}

const warrantyInclude = {
  customer: true,
  ruleVersion: { include: { rule: true } },
  warrantyUnit: { include: { orderLineItem: { include: { order: true } } } },
} as const;

const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers: {
      Query: {
        health: () => "ok",
        home: async (_: unknown, __: unknown, ctx: { request: Request }) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const shop = await prisma.shop.findUniqueOrThrow({ where: { id: merchant.shopId } });
          const openClaims = await prisma.claim.count({
            where: { shopId: shop.id, status: { in: ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"] } },
          });
          const activeWarranties = await prisma.warranty.count({
            where: { shopId: shop.id, status: { in: ["ACTIVE", "EXPIRING_SOON"] } },
          });
          const startOfMonth = new Date();
          startOfMonth.setUTCDate(1);
          startOfMonth.setUTCHours(0, 0, 0, 0);
          const endOfMonth = new Date(
            Date.UTC(startOfMonth.getUTCFullYear(), startOfMonth.getUTCMonth() + 1, 0, 23, 59, 59),
          );
          const expiringThisMonth = await prisma.warranty.count({
            where: {
              shopId: shop.id,
              status: { in: ["ACTIVE", "EXPIRING_SOON"] },
              endAt: { gte: startOfMonth, lte: endOfMonth },
            },
          });
          const pendingRegs = await prisma.registration.count({
            where: { shopId: shop.id, status: "PENDING_VERIFICATION" },
          });
          const ruleCount = await prisma.warrantyRule.count({ where: { shopId: shop.id } });
          const setupChecklist = [];
          if (ruleCount === 0) {
            setupChecklist.push({
              id: "create-rule",
              type: "setup",
              title: "Create your first warranty rule",
              href: "/products-rules",
            });
          }
          if (!shop.backfillLookbackMonths) {
            setupChecklist.push({
              id: "run-backfill",
              type: "setup",
              title: "Backfill historical warranties",
              href: "/warranties",
            });
          }
          if (!shop.onboardingCompleted) {
            setupChecklist.push({
              id: "customize-pages",
              type: "setup",
              title: "Customize customer pages",
              href: "/settings",
            });
          }
          const needsAttention = [];
          if (pendingRegs > 0) {
            needsAttention.push({
              id: "pending-regs",
              type: "registration",
              title: `${pendingRegs} registration(s) pending verification`,
              href: "/registrations",
            });
          }
          if (openClaims > 0) {
            needsAttention.push({
              id: "open-claims",
              type: "claim",
              title: `${openClaims} open claim(s)`,
              href: "/claims",
            });
          }
          return {
            shop: await shopSummary(shop.id),
            kpis: {
              openClaims,
              awaitingAction: openClaims + pendingRegs,
              activeWarranties,
              expiringThisMonth,
              claimRate30d: 0,
            },
            needsAttention,
            setupChecklist,
          };
        },
        warrantyRules: async (_: unknown, __: unknown, ctx: { request: Request }) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const rules = await listWarrantyRules(merchant.shopId);
          return rules.map((r) =>
            mapRule({
              ...r,
              versions: r.versions,
            } as NonNullable<Awaited<ReturnType<typeof getWarrantyRule>>>),
          );
        },
        warrantyRule: async (_: unknown, args: { id: string }, ctx: { request: Request }) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const rule = await getWarrantyRule(merchant.shopId, args.id);
          return rule ? mapRule(rule) : null;
        },
        warranties: async (
          _: unknown,
          args: { query?: string; status?: string; limit?: number; offset?: number },
          ctx: { request: Request },
        ) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const limit = Math.min(args.limit ?? 50, 100);
          const offset = args.offset ?? 0;
          const where: Record<string, unknown> = { shopId: merchant.shopId };
          if (args.status) where.status = args.status;
          if (args.query) {
            const q = args.query.trim();
            where.OR = [
              { certificateToken: { contains: q } },
              { customer: { email: { contains: q, mode: "insensitive" } } },
              { warrantyUnit: { serialNumber: { contains: q, mode: "insensitive" } } },
              {
                warrantyUnit: {
                  orderLineItem: { order: { orderNumber: { contains: q, mode: "insensitive" } } },
                },
              },
            ];
          }
          const [nodes, total] = await Promise.all([
            prisma.warranty.findMany({
              where,
              include: warrantyInclude,
              orderBy: { createdAt: "desc" },
              take: limit,
              skip: offset,
            }),
            prisma.warranty.count({ where }),
          ]);
          return {
            nodes: await Promise.all(nodes.map(mapWarranty)),
            total,
          };
        },
        warranty: async (_: unknown, args: { id: string }, ctx: { request: Request }) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const w = await prisma.warranty.findFirst({
            where: { id: args.id, shopId: merchant.shopId },
            include: warrantyInclude,
          });
          return w ? mapWarranty(w) : null;
        },
        products: async (_: unknown, args: { limit?: number }, ctx: { request: Request }) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const products = await prisma.product.findMany({
            where: { shopId: merchant.shopId },
            take: args.limit ?? 50,
            orderBy: { updatedAt: "desc" },
          });
          const rules = await listWarrantyRules(merchant.shopId);
          return products.map((p) => {
            const hasProductRule = rules.some((r) =>
              r.assignments.some(
                (a) => a.targetType === "product" && a.targetId === p.shopifyProductId,
              ),
            );
            const hasDefault = rules.some(
              (r) => r.active && r.assignments.some((a) => a.targetType === "default"),
            );
            return {
              id: p.id,
              title: p.title,
              shopifyProductId: p.shopifyProductId,
              imageUrl: p.imageUrl,
              coverageLabel: hasProductRule
                ? "Product rule"
                : hasDefault
                  ? "Default rule"
                  : "No coverage",
            };
          });
        },
        jobs: async (_: unknown, args: { type?: string; limit?: number }, ctx: { request: Request }) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const jobs = await prisma.job.findMany({
            where: {
              shopId: merchant.shopId,
              ...(args.type ? { type: args.type } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: args.limit ?? 20,
          });
          return jobs.map((j) => ({
            id: j.id,
            type: j.type,
            status: j.status,
            progress: j.progress,
            total: j.total,
            errorSummary: j.errorSummary,
            result: j.result ? JSON.stringify(j.result) : null,
            createdAt: j.createdAt.toISOString(),
          }));
        },
      },
      Mutation: {
        completeOnboardingStep: async (
          _: unknown,
          args: { step: string },
          ctx: { request: Request },
        ) => {
          const merchant = await resolveMerchantContext(ctx.request);
          if (args.step === "done") {
            await prisma.shop.update({
              where: { id: merchant.shopId },
              data: { onboardingCompleted: true },
            });
          }
          return shopSummary(merchant.shopId);
        },
        createWarrantyRule: async (
          _: unknown,
          args: {
            input: {
              name: string;
              priority?: number;
              version: {
                warrantyType: string;
                durationMonths?: number | null;
                startDateRule: string;
                serialMode: string;
                gracePeriodDays?: number;
                termsHtml?: string;
              };
              assignments: { targetType: string; targetId?: string | null }[];
            };
          },
          ctx: { request: Request },
        ) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const rule = await createWarrantyRule({
            shopId: merchant.shopId,
            name: args.input.name,
            priority: args.input.priority,
            version: {
              warrantyType: args.input.version.warrantyType,
              durationMonths: args.input.version.durationMonths ?? null,
              startDateRule: args.input.version.startDateRule as never,
              serialMode: args.input.version.serialMode as never,
              gracePeriodDays: args.input.version.gracePeriodDays,
              termsHtml: args.input.version.termsHtml,
            },
            assignments: args.input.assignments.map((a) => ({
              targetType: a.targetType as "variant" | "product" | "collection" | "default",
              targetId: a.targetId,
            })),
          });
          return mapRule(rule!);
        },
        updateWarrantyRule: async (
          _: unknown,
          args: {
            id: string;
            name?: string;
            priority?: number;
            active?: boolean;
            assignments?: { targetType: string; targetId?: string | null }[];
          },
          ctx: { request: Request },
        ) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const rule = await updateRuleMeta({
            shopId: merchant.shopId,
            ruleId: args.id,
            name: args.name,
            priority: args.priority,
            active: args.active,
            assignments: args.assignments?.map((a) => ({
              targetType: a.targetType as "variant" | "product" | "collection" | "default",
              targetId: a.targetId,
            })),
          });
          return mapRule(rule!);
        },
        publishWarrantyRuleVersion: async (
          _: unknown,
          args: {
            id: string;
            version: {
              warrantyType: string;
              durationMonths?: number | null;
              startDateRule: string;
              serialMode: string;
              gracePeriodDays?: number;
              termsHtml?: string;
            };
          },
          ctx: { request: Request },
        ) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const rule = await publishRuleVersion({
            shopId: merchant.shopId,
            ruleId: args.id,
            version: {
              warrantyType: args.version.warrantyType,
              durationMonths: args.version.durationMonths ?? null,
              startDateRule: args.version.startDateRule as never,
              serialMode: args.version.serialMode as never,
              gracePeriodDays: args.version.gracePeriodDays,
              termsHtml: args.version.termsHtml,
            },
          });
          return mapRule(rule!);
        },
        createManualWarranty: async (
          _: unknown,
          args: {
            input: {
              customerEmail?: string;
              productTitle: string;
              shopifyProductId?: string;
              shopifyVariantId?: string;
              serialNumber?: string;
              ruleId: string;
              purchaseAt: string;
              startAt?: string;
              reason: string;
            };
          },
          ctx: { request: Request },
        ) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const created = await createManualWarranty({
            shopId: merchant.shopId,
            customerEmail: args.input.customerEmail,
            productTitle: args.input.productTitle,
            shopifyProductId: args.input.shopifyProductId,
            shopifyVariantId: args.input.shopifyVariantId,
            serialNumber: args.input.serialNumber,
            ruleId: args.input.ruleId,
            purchaseAt: new Date(args.input.purchaseAt),
            startAt: args.input.startAt ? new Date(args.input.startAt) : undefined,
            reason: args.input.reason,
          });
          const w = await prisma.warranty.findFirstOrThrow({
            where: { id: created.id, shopId: merchant.shopId },
            include: warrantyInclude,
          });
          return mapWarranty(w);
        },
        voidWarranty: async (
          _: unknown,
          args: { id: string; reason: string },
          ctx: { request: Request },
        ) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const existing = await prisma.warranty.findFirst({
            where: { id: args.id, shopId: merchant.shopId },
          });
          if (!existing) throw new Error("Warranty not found");
          await prisma.warranty.update({
            where: { id: existing.id },
            data: { status: "VOID", voidReason: args.reason },
          });
          await prisma.warrantyUnit.update({
            where: { id: existing.warrantyUnitId },
            data: { status: "VOID" },
          });
          await prisma.activityLog.create({
            data: {
              shopId: merchant.shopId,
              actorType: "staff",
              action: "warranty.voided",
              entityType: "warranty",
              entityId: existing.id,
              before: { status: existing.status },
              after: { status: "VOID", reason: args.reason },
            },
          });
          const w = await prisma.warranty.findFirstOrThrow({
            where: { id: existing.id },
            include: warrantyInclude,
          });
          return mapWarranty(w);
        },
        extendWarranty: async (
          _: unknown,
          args: { id: string; extraMonths: number; reason: string },
          ctx: { request: Request },
        ) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const existing = await prisma.warranty.findFirst({
            where: { id: args.id, shopId: merchant.shopId },
          });
          if (!existing) throw new Error("Warranty not found");
          const { addCalendarMonths, endOfDayInTimezone } = await import("@aftersale/shared");
          const base = existing.endAt ?? existing.startAt ?? new Date();
          const extended = addCalendarMonths(base, args.extraMonths);
          const endAt = endOfDayInTimezone(extended, existing.timezone);
          await prisma.warranty.update({
            where: { id: existing.id },
            data: {
              endAt,
              status: endAt.getTime() < Date.now() ? "EXPIRED" : "ACTIVE",
            },
          });
          await prisma.activityLog.create({
            data: {
              shopId: merchant.shopId,
              actorType: "staff",
              action: "warranty.extended",
              entityType: "warranty",
              entityId: existing.id,
              before: { endAt: existing.endAt },
              after: { endAt, reason: args.reason, extraMonths: args.extraMonths },
            },
          });
          const w = await prisma.warranty.findFirstOrThrow({
            where: { id: existing.id },
            include: warrantyInclude,
          });
          return mapWarranty(w);
        },
        startBackfill: async (
          _: unknown,
          args: { lookbackMonths: number },
          ctx: { request: Request },
        ) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const months = args.lookbackMonths;
          if (![12, 24, 0].includes(months) && months < 0) {
            throw new Error("lookbackMonths must be 12, 24, or 0 (all available)");
          }
          const job = await prisma.job.create({
            data: {
              shopId: merchant.shopId,
              type: "backfill",
              status: "PENDING",
              payload: { lookbackMonths: months === 0 ? null : months },
            },
          });
          await enqueueBackfill(job.id);
          return {
            id: job.id,
            type: job.type,
            status: job.status,
            progress: 0,
            total: 0,
            errorSummary: null,
            result: null,
            createdAt: job.createdAt.toISOString(),
          };
        },
        updateShopSettings: async (
          _: unknown,
          args: { voidWarrantyOnRefund?: boolean; timezone?: string },
          ctx: { request: Request },
        ) => {
          const merchant = await resolveMerchantContext(ctx.request);
          await prisma.shop.update({
            where: { id: merchant.shopId },
            data: {
              voidWarrantyOnRefund: args.voidWarrantyOnRefund,
              timezone: args.timezone,
            },
          });
          return shopSummary(merchant.shopId);
        },
      },
    },
  }),
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

async function handle(request: Request) {
  try {
    return await yoga.fetch(request, { request });
  } catch (err) {
    if (err instanceof SessionTokenStaleError) {
      return new Response(
        JSON.stringify({ errors: [{ message: err.message, extensions: { code: err.code } }] }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Retry-Invalid-Session-Request": "1",
          },
        },
      );
    }
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED")) {
      return new Response(
        JSON.stringify({
          errors: [{ message: err.message, extensions: { code: "UNAUTHORIZED" } }],
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    console.error(err);
    return new Response(JSON.stringify({ errors: [{ message: err instanceof Error ? err.message : "Internal error" }] }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const GET = handle;
export const POST = handle;
