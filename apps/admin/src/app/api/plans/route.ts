import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aftersale/db";
import { verifyAdminToken } from "@/lib/auth";
import { audit } from "@/lib/admin-db";

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new Error("Unauthorized");
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ plans });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

const INT_FIELDS = [
  "priceMonthlyCents",
  "warrantiesPerMonth",
  "claimsPerMonth",
  "attachmentStorageMb",
  "staffSeats",
  "aiCreditsPerMonth",
  "warrantyRulesLimit",
  "locationsLimit",
  "technicianAccounts",
  "sortOrder",
] as const;

const BOOL_FIELDS = [
  "isFree",
  "publicApiEnabled",
  "customBranding",
  "pdfCertificate",
  "qrCodes",
  "csvExport",
  "backfillBeyond12Months",
  "repairsEnabled",
  "customWorkflows",
  "advancedAnalytics",
  "flowEnabled",
  "expiryCampaigns",
  "bulkOperations",
  "supplierPortal",
  "technicianPortal",
  "partsInventory",
  "multiLocation",
  "erpConnectors",
] as const;

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      shopifyPlanName?: string | null;
      [key: string]: unknown;
    };
    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const existing = await prisma.plan.findUnique({ where: { id: body.id } });
    if (!existing) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.shopifyPlanName === null || typeof body.shopifyPlanName === "string") {
      data.shopifyPlanName = body.shopifyPlanName;
    }
    for (const key of INT_FIELDS) {
      if (typeof body[key] === "number" && Number.isFinite(body[key])) {
        data[key] = Math.max(0, Math.floor(body[key] as number));
      }
    }
    for (const key of BOOL_FIELDS) {
      if (typeof body[key] === "boolean") data[key] = body[key];
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const plan = await prisma.plan.update({ where: { id: body.id }, data });
    await audit({
      adminUserId: admin.sub,
      action: "plan.updated",
      reason: `Updated plan ${plan.slug}`,
      before: existing,
      after: plan,
    });
    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : message },
      { status: message === "Unauthorized" ? 401 : 400 },
    );
  }
}
