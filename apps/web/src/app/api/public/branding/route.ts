import { NextRequest, NextResponse } from "next/server";
import { shopRepository } from "@aftersale/db";
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
  });
}
