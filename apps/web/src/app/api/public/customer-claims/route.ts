import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { withPublicCors, publicCorsPreflight } from "@/lib/public-cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return publicCorsPreflight(request.headers.get("origin"));
}

/** List claims for a verified customer email (portal “My Requests”). */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try {
    const body = (await request.json()) as { shop?: string; email?: string };
    const shopParam = body.shop || request.nextUrl.searchParams.get("shop");
    const email = (body.email ?? "").trim().toLowerCase();
    if (!shopParam) {
      return withPublicCors(NextResponse.json({ error: "shop required" }, { status: 400 }), origin);
    }
    if (!email || !email.includes("@")) {
      return withPublicCors(NextResponse.json({ error: "email required" }, { status: 400 }), origin);
    }

    const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
    if (!shop || shop.status === "UNINSTALLED") {
      return withPublicCors(NextResponse.json({ error: "Shop not found" }, { status: 404 }), origin);
    }

    const claims = await prisma.claim.findMany({
      where: { shopId: shop.id, customerEmail: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        warrantyUnit: { include: { orderLineItem: { select: { title: true } } } },
      },
    });

    const appBase = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "https://aftersale.tidyflowapp.com"
    ).replace(/\/$/, "");

    return withPublicCors(
      NextResponse.json({
        claims: claims.map((c) => ({
          id: c.id,
          claimNumber: c.claimNumber,
          status: c.status,
          issueSummary: c.issueSummary,
          productTitle: c.warrantyUnit?.orderLineItem.title ?? null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          trackingUrl: `${appBase}/apps/aftersale/claim/${c.publicToken}?shop=${encodeURIComponent(shop.shopDomain)}`,
        })),
      }),
      origin,
    );
  } catch (err) {
    return withPublicCors(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed" },
        { status: 500 },
      ),
      origin,
    );
  }
}
