import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aftersale/db";
import { getOfflineSession, shopify } from "@/lib/shopify/client";
import { resolveMerchantContext } from "@/lib/auth/merchant";

/**
 * Billing skeleton: create a Shopify app subscription for a paid plan.
 * Free plan is modeled as no active charge.
 */
export async function GET(request: NextRequest) {
  try {
    const merchant = await resolveMerchantContext(request);
    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id: merchant.shopId },
      include: { plan: true, billingCharges: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json({
      current: shop.plan,
      billingStatus: shop.billingStatus,
      charges: shop.billingCharges,
      plans,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const merchant = await resolveMerchantContext(request);
    const body = (await request.json()) as { planSlug?: string };
    if (!body.planSlug) {
      return NextResponse.json({ error: "planSlug required" }, { status: 400 });
    }

    const plan = await prisma.plan.findUnique({ where: { slug: body.planSlug } });
    if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 404 });

    if (plan.isFree) {
      await prisma.shop.update({
        where: { id: merchant.shopId },
        data: {
          planId: plan.id,
          billingStatus: "ACTIVE",
          shopifySubscriptionId: null,
        },
      });
      return NextResponse.json({ ok: true, plan, confirmationUrl: null });
    }

    const session = await getOfflineSession(merchant.shopDomain);
    if (!session) {
      return NextResponse.json({ error: "Reconnect required" }, { status: 401 });
    }

    const returnUrl = `${process.env.APP_URL}/?shop=${merchant.shopDomain}&billing=return`;
    const test = process.env.SHOPIFY_BILLING_TEST === "true";
    const client = new shopify.clients.Graphql({ session });

    const result = await client.request(
      `#graphql
      mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $amount: Decimal!, $test: Boolean) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          test: $test
          lineItems: [{
            plan: {
              appRecurringPricingDetails: {
                price: { amount: $amount, currencyCode: USD }
                interval: EVERY_30_DAYS
              }
            }
          }]
        ) {
          appSubscription { id status }
          confirmationUrl
          userErrors { field message }
        }
      }
    `,
      {
        variables: {
          name: `AfterSale OS ${plan.name}`,
          returnUrl,
          amount: (plan.priceMonthlyCents / 100).toFixed(2),
          test,
        },
      },
    );

    const payload = (
      result.data as {
        appSubscriptionCreate: {
          appSubscription: { id: string; status: string } | null;
          confirmationUrl: string | null;
          userErrors: { message: string }[];
        };
      }
    ).appSubscriptionCreate;

    if (payload.userErrors?.length) {
      return NextResponse.json({ error: payload.userErrors.map((e) => e.message).join(", ") }, { status: 400 });
    }

    if (payload.appSubscription) {
      await prisma.billingCharge.create({
        data: {
          shopId: merchant.shopId,
          type: "RECURRING",
          shopifyChargeId: payload.appSubscription.id,
          status: "PENDING",
          amountCents: plan.priceMonthlyCents,
          planId: plan.id,
        },
      });
      await prisma.shop.update({
        where: { id: merchant.shopId },
        data: {
          billingStatus: "PENDING_APPROVAL",
          shopifySubscriptionId: payload.appSubscription.id,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      confirmationUrl: payload.confirmationUrl,
      subscriptionId: payload.appSubscription?.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Billing error" },
      { status: 500 },
    );
  }
}
