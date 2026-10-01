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

  const requests = await prisma.privacyRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      shopDomain: r.shopDomain,
      type: r.type,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      dueAt: r.dueAt?.toISOString() ?? null,
    })),
  });
}
