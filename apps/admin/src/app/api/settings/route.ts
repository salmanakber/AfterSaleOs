import { NextRequest, NextResponse } from "next/server";
import {
  getPlatformSetting,
  setPlatformSetting,
  isShopifyBillingTestMode,
  getResendConfig,
  PLATFORM_KEYS,
} from "@aftersale/db";
import { verifyAdminToken } from "@/lib/auth";

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new Error("Unauthorized");
  await verifyAdminToken(token);
}

function hintKey(value: string | null | undefined) {
  const v = value?.trim();
  if (!v) return null;
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 3)}…${v.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const billingTestMode = await isShopifyBillingTestMode();
    const stored = await getPlatformSetting(PLATFORM_KEYS.SHOPIFY_BILLING_TEST);
    const resend = await getResendConfig();
    const fromPlatform = await getPlatformSetting(PLATFORM_KEYS.RESEND_FROM_EMAIL);
    const namePlatform = await getPlatformSetting(PLATFORM_KEYS.RESEND_FROM_NAME);
    const replyPlatform = await getPlatformSetting(PLATFORM_KEYS.RESEND_REPLY_TO);

    return NextResponse.json({
      shopifyBillingTest: billingTestMode,
      source: stored == null ? "env" : "platform",
      envFallback: process.env.SHOPIFY_BILLING_TEST === "true",
      resend: {
        configured: Boolean(resend.apiKey && resend.fromEmail),
        apiKeySource: resend.apiKeySource,
        apiKeyHint: resend.apiKey ? hintKey(resend.apiKey) : null,
        fromEmail: resend.fromEmail || "",
        fromEmailSource: resend.fromEmailSource,
        fromName: resend.fromName || "",
        fromNameSource: namePlatform?.trim()
          ? "platform"
          : process.env.RESEND_FROM_NAME
            ? "env"
            : "none",
        replyTo: resend.replyTo || "",
        replyToSource: replyPlatform?.trim()
          ? "platform"
          : process.env.RESEND_REPLY_TO
            ? "env"
            : "none",
        fromEmailStored: Boolean(fromPlatform?.trim()),
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as {
      shopifyBillingTest?: boolean;
      resend?: {
        apiKey?: string;
        clearApiKey?: boolean;
        fromEmail?: string;
        fromName?: string;
        replyTo?: string;
      };
    };

    if (typeof body.shopifyBillingTest === "boolean") {
      await setPlatformSetting(
        PLATFORM_KEYS.SHOPIFY_BILLING_TEST,
        body.shopifyBillingTest ? "true" : "false",
      );
    }

    if (body.resend) {
      if (body.resend.clearApiKey) {
        await setPlatformSetting(PLATFORM_KEYS.RESEND_API_KEY, "");
      } else if (typeof body.resend.apiKey === "string" && body.resend.apiKey.trim()) {
        await setPlatformSetting(PLATFORM_KEYS.RESEND_API_KEY, body.resend.apiKey.trim());
      }
      if (typeof body.resend.fromEmail === "string") {
        await setPlatformSetting(PLATFORM_KEYS.RESEND_FROM_EMAIL, body.resend.fromEmail.trim());
      }
      if (typeof body.resend.fromName === "string") {
        await setPlatformSetting(PLATFORM_KEYS.RESEND_FROM_NAME, body.resend.fromName.trim());
      }
      if (typeof body.resend.replyTo === "string") {
        await setPlatformSetting(PLATFORM_KEYS.RESEND_REPLY_TO, body.resend.replyTo.trim());
      }
    }

    if (typeof body.shopifyBillingTest !== "boolean" && !body.resend) {
      return NextResponse.json(
        { error: "shopifyBillingTest or resend payload required" },
        { status: 400 },
      );
    }

    const billingTestMode = await isShopifyBillingTestMode();
    const resend = await getResendConfig();

    return NextResponse.json({
      ok: true,
      shopifyBillingTest: billingTestMode,
      source: "platform",
      resend: {
        configured: Boolean(resend.apiKey && resend.fromEmail),
        apiKeySource: resend.apiKeySource,
        apiKeyHint: resend.apiKey ? hintKey(resend.apiKey) : null,
        fromEmail: resend.fromEmail || "",
        fromEmailSource: resend.fromEmailSource,
        fromName: resend.fromName || "",
        replyTo: resend.replyTo || "",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
