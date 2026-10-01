import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aftersale/db";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const warranty = await prisma.warranty.findUnique({
    where: { certificateToken: token },
    include: {
      shop: true,
      customer: true,
      ruleVersion: { include: { rule: true } },
      warrantyUnit: { include: { orderLineItem: { include: { order: true } } } },
    },
  });

  if (!warranty || warranty.status === "VOID") {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  return NextResponse.json({
    certificateToken: warranty.certificateToken,
    status: warranty.status,
    startAt: warranty.startAt?.toISOString() ?? null,
    endAt: warranty.endAt?.toISOString() ?? null,
    productTitle: warranty.warrantyUnit.orderLineItem.title,
    orderNumber: warranty.warrantyUnit.orderLineItem.order.orderNumber,
    serialNumber: warranty.warrantyUnit.serialNumber,
    customerName: [warranty.customer?.firstName, warranty.customer?.lastName]
      .filter(Boolean)
      .join(" ") || null,
    ruleName: warranty.ruleVersion.rule.name,
    warrantyType: warranty.ruleVersion.warrantyType,
    termsHtml: warranty.ruleVersion.termsHtml,
    durationMonths: warranty.ruleVersion.durationMonths,
    shop: {
      shopName: warranty.shop.shopName,
      shopDomain: warranty.shop.shopDomain,
      brandingAccentColor: warranty.shop.brandingAccentColor,
      brandingLogoUrl: warranty.shop.brandingLogoUrl,
    },
  });
}
