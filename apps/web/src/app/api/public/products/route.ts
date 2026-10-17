import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { withPublicCors, publicCorsPreflight } from "@/lib/public-cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return publicCorsPreflight(request.headers.get("origin"));
}

/** Search synced store products for customer portal product picker. */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const sp = request.nextUrl.searchParams;
  const shopParam = sp.get("shop");
  const q = (sp.get("q") ?? "").trim();
  const limit = Math.min(Number(sp.get("limit") ?? 24) || 24, 40);

  if (!shopParam) {
    return withPublicCors(NextResponse.json({ error: "shop required" }, { status: 400 }), origin);
  }

  const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
  if (!shop || shop.status === "UNINSTALLED") {
    return withPublicCors(NextResponse.json({ error: "Shop not found" }, { status: 404 }), origin);
  }

  const products = await prisma.product.findMany({
    where: {
      shopId: shop.id,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { vendor: { contains: q, mode: "insensitive" } },
              { productType: { contains: q, mode: "insensitive" } },
              { handle: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      status: { not: "archived" },
    },
    include: {
      variants: {
        take: 8,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          shopifyVariantId: true,
          title: true,
          sku: true,
          priceCents: true,
        },
      },
    },
    orderBy: { title: "asc" },
    take: limit,
  });

  return withPublicCors(
    NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        shopifyProductId: p.shopifyProductId,
        title: p.title,
        handle: p.handle,
        imageUrl: p.imageUrl,
        vendor: p.vendor,
        productType: p.productType,
        variants: p.variants.map((v) => ({
          id: v.id,
          shopifyVariantId: v.shopifyVariantId,
          title: v.title,
          sku: v.sku,
          priceCents: v.priceCents,
        })),
      })),
    }),
    origin,
  );
}
