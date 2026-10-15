import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { withPublicCors, publicCorsPreflight } from "@/lib/public-cors";

export const runtime = "nodejs";

/**
 * Same-origin fee config for theme JS via Shopify App Proxy:
 *   https://{shop}/apps/aftersale/fee
 * Also works cross-origin with CORS from the hosted app URL.
 */
async function feePayload(shopParam: string | null) {
  if (!shopParam) {
    return NextResponse.json({ error: "shop required" }, { status: 400 });
  }
  const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
  if (!shop || shop.status === "UNINSTALLED") {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const feeVariantId = shop.warrantyFeeVariantId?.replace(/\D/g, "") || null;
  let warrantyFeeCents: number | null = null;
  if (shop.warrantyFeeEnabled && feeVariantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { shopId: shop.id, shopifyVariantId: feeVariantId },
      select: { priceCents: true },
    });
    warrantyFeeCents = variant?.priceCents ?? null;
  }

  return NextResponse.json({
    warrantyFeeEnabled: Boolean(shop.warrantyFeeEnabled),
    warrantyFeeVariantId: feeVariantId,
    warrantyFeeLabel: shop.warrantyFeeLabel ?? "Product warranty registration",
    warrantyFeeCents,
    currency: shop.currency ?? "USD",
    shopDomain: shop.shopDomain,
  });
}

export async function OPTIONS(request: NextRequest) {
  return publicCorsPreflight(request.headers.get("origin"));
}

export async function GET(request: NextRequest) {
  const shopParam =
    request.nextUrl.searchParams.get("shop") ||
    request.nextUrl.searchParams.get("shopDomain");
  const res = await feePayload(shopParam);
  return withPublicCors(res, request.headers.get("origin"));
}
