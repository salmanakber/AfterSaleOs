import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { shopifyGraphqlRequest } from "@/lib/shopify/client";
import { withPublicCors, publicCorsPreflight } from "@/lib/public-cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return publicCorsPreflight(request.headers.get("origin"));
}

async function resolveFeeCents(shopDomain: string, shopId: string, feeVariantId: string) {
  const local = await prisma.productVariant.findFirst({
    where: { shopId, shopifyVariantId: feeVariantId },
    select: { priceCents: true },
  });
  if (local?.priceCents != null && local.priceCents > 0) {
    return local.priceCents;
  }

  // Live Admin price — covers fee products not yet synced into AfterSale.
  try {
    const gid = `gid://shopify/ProductVariant/${feeVariantId}`;
    const data = await shopifyGraphqlRequest<{
      productVariant: { price?: string | null } | null;
    }>(
      shopDomain,
      `#graphql
        query WarrantyFeePrice($id: ID!) {
          productVariant(id: $id) { price }
        }`,
      { id: gid },
    );
    const price = data.productVariant?.price;
    if (price != null && price !== "") {
      const cents = Math.round(parseFloat(price) * 100);
      if (Number.isFinite(cents)) {
        // Best-effort cache so next request is fast.
        if (local) {
          await prisma.productVariant.updateMany({
            where: { shopId, shopifyVariantId: feeVariantId },
            data: { priceCents: cents },
          });
        }
        return cents;
      }
    }
  } catch {
    /* offline session / missing scope — storefront JS still fetches /variants/{id}.js */
  }

  return local?.priceCents ?? null;
}

/** Public branding for customer / embed surfaces (no secrets). */
export async function GET(request: NextRequest) {
  const shopParam = request.nextUrl.searchParams.get("shop");
  if (!shopParam) {
    return NextResponse.json({ error: "shop required" }, { status: 400 });
  }
  const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
  if (!shop || shop.status === "UNINSTALLED") {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  let warrantyFeeCents: number | null = null;
  const feeVariantId = shop.warrantyFeeVariantId?.replace(/\D/g, "") || null;
  if (shop.warrantyFeeEnabled && feeVariantId) {
    warrantyFeeCents = await resolveFeeCents(shop.shopDomain, shop.id, feeVariantId);
  }

  const res = NextResponse.json({
    shopName: shop.shopName ?? shop.shopDomain,
    shopDomain: shop.shopDomain,
    logoUrl: shop.brandingLogoUrl,
    accentColor: shop.brandingAccentColor ?? "#F59E0B",
    bgColor: shop.brandingBgColor ?? null,
    surfaceColor: shop.brandingSurfaceColor ?? null,
    textColor: shop.brandingTextColor ?? null,
    font: shop.brandingFont ?? "sans",
    radius: shop.brandingRadius ?? 22,
    buttonStyle: shop.brandingButtonStyle ?? "solid",
    heroStyle: shop.brandingHeroStyle ?? "bold",
    warrantyOptInRequired: shop.warrantyOptInRequired !== false,
    warrantyOptInUiEnabled: shop.warrantyOptInUiEnabled !== false,
    warrantyFeeEnabled: Boolean(shop.warrantyFeeEnabled),
    warrantyFeeVariantId: feeVariantId,
    warrantyFeeLabel: shop.warrantyFeeLabel ?? "Product warranty registration",
    warrantyFeeCents,
    currency: shop.currency ?? "USD",
  });
  return withPublicCors(res, request.headers.get("origin"));
}
