import { NextRequest, NextResponse } from "next/server";
import { consumeGuestToken, getPortalWarranties, prisma } from "@aftersale/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Exchange guest token → portal warranty list (one-time token). */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { token?: string };
  if (!body.token) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await rateLimit({ key: `portal:${ip}`, limit: 30, windowSeconds: 600 });
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const row = await consumeGuestToken(body.token);
  if (!row) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const warranties = await getPortalWarranties({
    shopId: row.shopId,
    email: row.email,
    orderNumber: row.orderNumber,
  });

  const shopRow = await prisma.shop.findUnique({ where: { id: row.shopId } });

  return NextResponse.json({
    shop: shopRow
      ? {
          shopDomain: shopRow.shopDomain,
          shopName: shopRow.shopName,
          brandingAccentColor: shopRow.brandingAccentColor,
          brandingLogoUrl: shopRow.brandingLogoUrl,
        }
      : null,
    email: row.email,
    warranties: warranties.map((w) => ({
      id: w.id,
      status: w.status,
      startAt: w.startAt?.toISOString() ?? null,
      endAt: w.endAt?.toISOString() ?? null,
      certificateToken: w.certificateToken,
      productTitle: w.warrantyUnit.orderLineItem.title,
      orderNumber: w.warrantyUnit.orderLineItem.order.orderNumber,
      serialNumber: w.warrantyUnit.serialNumber,
      ruleName: w.ruleVersion.rule.name,
      warrantyType: w.ruleVersion.warrantyType,
      termsHtml: w.ruleVersion.termsHtml,
    })),
  });
}
