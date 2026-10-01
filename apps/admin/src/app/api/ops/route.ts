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

  const [webhookEvents, jobFailures, jobs] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: { status: { in: ["PENDING", "FAILED", "DEAD"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.jobFailure.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { shop: { select: { shopDomain: true } } },
    }),
  ]);

  return NextResponse.json({
    webhookEvents: webhookEvents.map((w) => ({
      id: w.id,
      shopDomain: w.shopDomain,
      topic: w.topic,
      status: w.status,
      attempts: w.attempts,
      lastError: w.lastError,
      createdAt: w.createdAt.toISOString(),
    })),
    jobFailures: jobFailures.map((f) => ({
      id: f.id,
      queue: f.queue,
      error: f.error,
      shopId: f.shopId,
      createdAt: f.createdAt.toISOString(),
    })),
    jobs: jobs.map((j) => ({
      id: j.id,
      shopDomain: j.shop?.shopDomain ?? null,
      type: j.type,
      status: j.status,
      progress: j.progress,
      errorSummary: j.errorSummary,
      createdAt: j.createdAt.toISOString(),
    })),
  });
}
