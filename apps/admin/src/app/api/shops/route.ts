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

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const shops = await prisma.shop.findMany({
    where: q ? { shopDomain: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { installedAt: "desc" },
    take: 100,
    include: { plan: true },
  });

  return NextResponse.json({
    shops: shops.map((s) => ({
      id: s.id,
      shopDomain: s.shopDomain,
      status: s.status,
      billingStatus: s.billingStatus,
      planName: s.plan?.name ?? null,
      installedAt: s.installedAt.toISOString(),
    })),
  });
}
