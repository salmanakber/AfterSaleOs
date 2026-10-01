import { createSchema, createYoga } from "graphql-yoga";
import { prisma, usageRepository } from "@aftersale/db";
import {
  resolveMerchantContext,
  SessionTokenStaleError,
} from "@/lib/auth/merchant";

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

  type Query {
    health: String!
    home: HomeDashboard!
  }

  type Mutation {
    completeOnboardingStep(step: String!): ShopSummary!
  }
`;

const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers: {
      Query: {
        health: () => "ok",
        home: async (_: unknown, __: unknown, ctx: { request: Request }) => {
          const merchant = await resolveMerchantContext(ctx.request);
          const shop = await prisma.shop.findUniqueOrThrow({
            where: { id: merchant.shopId },
            include: { plan: true },
          });

          const plan = shop.plan;
          const warrantiesUsed = await usageRepository.getCount(shop.id, "warranties_created");
          const claimsUsed = await usageRepository.getCount(shop.id, "claims_created");
          const aiUsed = await usageRepository.getCount(shop.id, "ai_credits");

          const openClaims = await prisma.claim.count({
            where: { shopId: shop.id, status: { in: ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"] } },
          });
          const activeWarranties = await prisma.warranty.count({
            where: { shopId: shop.id, status: { in: ["ACTIVE", "EXPIRING_SOON"] } },
          });
          const startOfMonth = new Date();
          startOfMonth.setUTCDate(1);
          startOfMonth.setUTCHours(0, 0, 0, 0);
          const endOfMonth = new Date(Date.UTC(startOfMonth.getUTCFullYear(), startOfMonth.getUTCMonth() + 1, 0, 23, 59, 59));
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

          const setupChecklist = [];
          const ruleCount = await prisma.warrantyRule.count({ where: { shopId: shop.id } });
          if (ruleCount === 0) {
            setupChecklist.push({
              id: "create-rule",
              type: "setup",
              title: "Create your first warranty rule",
              href: "/products-rules",
            });
          }
          if (!shop.onboardingCompleted) {
            setupChecklist.push({
              id: "review-backfill",
              type: "setup",
              title: "Review backfilled warranties",
              href: "/warranties",
            });
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
            shop: {
              id: shop.id,
              shopDomain: shop.shopDomain,
              shopName: shop.shopName,
              status: shop.status,
              onboardingCompleted: shop.onboardingCompleted,
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
                  used: warrantiesUsed,
                  limit: plan?.warrantiesPerMonth ?? 50,
                },
                {
                  metric: "claims_created",
                  used: claimsUsed,
                  limit: plan?.claimsPerMonth ?? 10,
                },
                {
                  metric: "ai_credits",
                  used: aiUsed,
                  limit: plan?.aiCreditsPerMonth ?? 10,
                },
              ],
            },
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
          const shop = await prisma.shop.findUniqueOrThrow({
            where: { id: merchant.shopId },
            include: { plan: true },
          });
          return {
            id: shop.id,
            shopDomain: shop.shopDomain,
            shopName: shop.shopName,
            status: shop.status,
            onboardingCompleted: shop.onboardingCompleted,
            plan: shop.plan,
            usage: [],
          };
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
      return new Response(JSON.stringify({ errors: [{ message: err.message, extensions: { code: err.code } }] }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Retry-Invalid-Session-Request": "1",
        },
      });
    }
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED")) {
      return new Response(JSON.stringify({ errors: [{ message: err.message, extensions: { code: "UNAUTHORIZED" } }] }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error(err);
    return new Response(JSON.stringify({ errors: [{ message: "Internal error" }] }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const GET = handle;
export const POST = handle;
