import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

/** Create or resolve a QR short code, then redirect to registration/support. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const link = await prisma.qrLink.findUnique({ where: { code } });
  if (!link || !link.active) {
    return NextResponse.json({ error: "QR not found" }, { status: 404 });
  }

  await prisma.qrScan.create({
    data: {
      shopId: link.shopId,
      qrLinkId: link.id,
      userAgent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
    },
  });
  await prisma.qrLink.update({
    where: { id: link.id },
    data: { scanCount: { increment: 1 } },
  });

  const shop = await prisma.shop.findUnique({ where: { id: link.shopId } });
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const q = new URLSearchParams({
    shop: shop?.shopDomain ?? "",
    qr: link.code,
  });
  if (link.targetType === "product" && link.targetId) q.set("product_id", link.targetId);
  if (link.targetType === "variant" && link.targetId) q.set("variant_id", link.targetId);

  // Hosted app URL — reliable (app-proxy pages need assetPrefix + absolute APIs).
  const base = appUrl.replace(/\/$/, "") || (shop?.shopDomain ? `https://${shop.shopDomain}` : "");
  return NextResponse.redirect(`${base}/apps/aftersale/register?${q.toString()}`);
}

export async function POST(request: NextRequest) {
  // Merchant-authenticated QR create is via GraphQL in a follow-up; this is a helper for seeding.
  const body = (await request.json()) as {
    shop?: string;
    targetType?: string;
    targetId?: string;
    label?: string;
  };
  if (!body.shop) return NextResponse.json({ error: "shop required" }, { status: 400 });
  const shop = await shopRepository.findByDomain(normalizeShopDomain(body.shop));
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const code = randomBytes(5).toString("base64url");
  const link = await prisma.qrLink.create({
    data: {
      shopId: shop.id,
      code,
      targetType: body.targetType ?? "product",
      targetId: body.targetId,
      label: body.label,
    },
  });

  const appUrl = process.env.APP_URL ?? "";
  return NextResponse.json({
    code: link.code,
    url: `${appUrl}/q/${link.code}`,
    storefrontHint: `https://${shop.shopDomain}/apps/aftersale/register?shop=${shop.shopDomain}&qr=${link.code}`,
  });
}
