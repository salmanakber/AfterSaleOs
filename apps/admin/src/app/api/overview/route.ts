import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aftersale/db";
import { verifyAdminToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifyAdminToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [total, active, uninstalled, failed, pendingWebhooks, openPrivacy, recentShops] =
    await Promise.all([
      prisma.shop.count(),
      prisma.shop.count({ where: { status: "ACTIVE" } }),
      prisma.shop.count({ where: { status: "UNINSTALLED" } }),
      prisma.jobFailure.count(),
      prisma.webhookEvent.count({ where: { status: { in: ["PENDING", "FAILED"] } } }),
      prisma.privacyRequest.count({ where: { status: { in: ["RECEIVED", "IN_PROGRESS"] } } }),
      prisma.shop.findMany({
        take: 20,
        orderBy: { installedAt: "desc" },
        include: { plan: true },
      }),
    ]);

  return NextResponse.json({
    shops: { total, active, uninstalled },
    jobs: { failed, pendingWebhooks },
    privacy: { open: openPrivacy },
    recentShops: recentShops.map((s) => ({
      id: s.id,
      shopDomain: s.shopDomain,
      status: s.status,
      planName: s.plan?.name ?? null,
      installedAt: s.installedAt.toISOString(),
    })),
  });
}
