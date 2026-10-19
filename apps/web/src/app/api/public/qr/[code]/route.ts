import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aftersale/db";
import { withPublicCors, publicCorsPreflight } from "@/lib/public-cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return publicCorsPreflight(request.headers.get("origin"));
}

/** Public QR metadata for scan landing — no login required. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const origin = request.headers.get("origin");
  const { code } = await params;
  const link = await prisma.qrLink.findUnique({ where: { code } });
  if (!link || !link.active) {
    return withPublicCors(NextResponse.json({ error: "QR not found" }, { status: 404 }), origin);
  }

  const shop = await prisma.shop.findUnique({ where: { id: link.shopId } });
  if (!shop || shop.status === "UNINSTALLED") {
    return withPublicCors(NextResponse.json({ error: "Shop not found" }, { status: 404 }), origin);
  }

  let product: {
    id: string;
    title: string;
    imageUrl: string | null;
    shopifyProductId: string;
  } | null = null;

  if (link.targetId && (link.targetType === "product" || link.targetType === "variant")) {
    const byInternal = await prisma.product.findFirst({
      where: { shopId: shop.id, id: link.targetId },
      select: { id: true, title: true, imageUrl: true, shopifyProductId: true },
    });
    if (byInternal) {
      product = byInternal;
    } else {
      const byShopify = await prisma.product.findFirst({
        where: { shopId: shop.id, shopifyProductId: link.targetId },
        select: { id: true, title: true, imageUrl: true, shopifyProductId: true },
      });
      product = byShopify;
    }
  }

  return withPublicCors(
    NextResponse.json({
      code: link.code,
      label: link.label,
      targetType: link.targetType,
      targetId: link.targetId,
      scanCount: link.scanCount,
      shop: shop.shopDomain,
      shopName: shop.shopName || shop.shopDomain.replace(".myshopify.com", ""),
      logoUrl: shop.brandingLogoUrl ?? null,
      accent: shop.brandingAccentColor ?? null,
      product,
    }),
    origin,
  );
}
