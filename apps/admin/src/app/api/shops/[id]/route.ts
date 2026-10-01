import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aftersale/db";
import { verifyAdminToken } from "@/lib/auth";
import { audit, maskEmail } from "@/lib/admin-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let admin: { sub: string };
  try {
    admin = await verifyAdminToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const shop = await prisma.shop.findUnique({
    where: { id },
    include: { plan: true, usageCounters: { take: 20, orderBy: { updatedAt: "desc" } } },
  });
  if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit({
    adminUserId: admin.sub,
    action: "admin.shop.view",
    shopId: shop.id,
    reason: "support_view",
    meta: { emailMasked: maskEmail(shop.email) },
  });

  const [webhookFailures, privacyOpen] = await Promise.all([
    prisma.webhookEvent.count({ where: { shopId: shop.id, status: { in: ["FAILED", "DEAD"] } } }),
    prisma.privacyRequest.count({
      where: { shopId: shop.id, status: { in: ["RECEIVED", "IN_PROGRESS"] } },
    }),
  ]);

  return NextResponse.json({
    shop: {
      id: shop.id,
      shopDomain: shop.shopDomain,
      shopName: shop.shopName,
      status: shop.status,
      billingStatus: shop.billingStatus,
      planName: shop.plan?.name ?? null,
      installedAt: shop.installedAt.toISOString(),
      usage: shop.usageCounters.map((u) => ({
        metric: u.metric,
        count: u.count,
        periodKey: u.periodKey,
      })),
      webhookFailures,
      privacyOpen,
    },
  });
}
