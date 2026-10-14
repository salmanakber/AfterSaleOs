import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";

export const runtime = "nodejs";

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
    const variant = await prisma.productVariant.findFirst({
      where: { shopId: shop.id, shopifyVariantId: feeVariantId },
      select: { priceCents: true },
    });
    warrantyFeeCents = variant?.priceCents ?? null;
  }

  return NextResponse.json({
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
    warrantyFeeEnabled: Boolean(shop.warrantyFeeEnabled),
    warrantyFeeVariantId: feeVariantId,
    warrantyFeeLabel: shop.warrantyFeeLabel ?? "Product warranty registration",
    warrantyFeeCents,
    currency: shop.currency ?? "USD",
  });
}
