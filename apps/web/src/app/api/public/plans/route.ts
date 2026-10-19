import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aftersale/db";
import { withPublicCors, publicCorsPreflight } from "@/lib/public-cors";
import { PLAN_FEATURE_META, type PlanFeatureKey } from "@/lib/plan-features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return publicCorsPreflight(request.headers.get("origin"));
}

/** Public plan catalog for marketing pricing (no auth). */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  try {
    const rows = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    const featureKeys = Object.keys(PLAN_FEATURE_META) as PlanFeatureKey[];

    const plans = rows.map((p) => {
      const features: Record<PlanFeatureKey, boolean> = {} as Record<PlanFeatureKey, boolean>;
      for (const key of featureKeys) {
        features[key] = Boolean(p[key]);
      }
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        priceMonthlyCents: p.priceMonthlyCents,
        isFree: p.isFree,
        warrantiesPerMonth: p.warrantiesPerMonth,
        claimsPerMonth: p.claimsPerMonth,
        aiCreditsPerMonth: p.aiCreditsPerMonth,
        staffSeats: p.staffSeats,
        warrantyRulesLimit: p.warrantyRulesLimit,
        attachmentStorageMb: p.attachmentStorageMb,
        locationsLimit: p.locationsLimit,
        technicianAccounts: p.technicianAccounts,
        sortOrder: p.sortOrder,
        features,
      };
    });

    return withPublicCors(
      NextResponse.json({
        plans,
        featureMeta: featureKeys.map((key) => ({
          key,
          label: PLAN_FEATURE_META[key].label,
          blurb: PLAN_FEATURE_META[key].blurb,
        })),
      }),
      origin,
    );
  } catch (err) {
    console.error("[public/plans]", err);
    return withPublicCors(
      NextResponse.json({ error: "Could not load plans" }, { status: 500 }),
      origin,
    );
  }
}
