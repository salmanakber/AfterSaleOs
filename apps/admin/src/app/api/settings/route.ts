import { NextRequest, NextResponse } from "next/server";
import {
  getPlatformSetting,
  setPlatformSetting,
  isShopifyBillingTestMode,
  PLATFORM_KEYS,
} from "@aftersale/db";
import { verifyAdminToken } from "@/lib/auth";

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new Error("Unauthorized");
  await verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const billingTestMode = await isShopifyBillingTestMode();
    const stored = await getPlatformSetting(PLATFORM_KEYS.SHOPIFY_BILLING_TEST);
    return NextResponse.json({
      shopifyBillingTest: billingTestMode,
      source: stored == null ? "env" : "platform",
      envFallback: process.env.SHOPIFY_BILLING_TEST === "true",
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as { shopifyBillingTest?: boolean };
    if (typeof body.shopifyBillingTest !== "boolean") {
      return NextResponse.json({ error: "shopifyBillingTest boolean required" }, { status: 400 });
    }
    await setPlatformSetting(
      PLATFORM_KEYS.SHOPIFY_BILLING_TEST,
      body.shopifyBillingTest ? "true" : "false",
    );
    return NextResponse.json({
      ok: true,
      shopifyBillingTest: body.shopifyBillingTest,
      source: "platform",
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
