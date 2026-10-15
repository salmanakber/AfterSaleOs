import { prisma } from "./client";

export const PLATFORM_KEYS = {
  SHOPIFY_BILLING_TEST: "shopify_billing_test",
  RESEND_API_KEY: "resend_api_key",
  RESEND_FROM_EMAIL: "resend_from_email",
  RESEND_FROM_NAME: "resend_from_name",
  RESEND_REPLY_TO: "resend_reply_to",
  AI_OPENAI_API_KEY: "ai_openai_api_key",
  AI_GROQ_API_KEY: "ai_groq_api_key",
  AI_GEMINI_API_KEY: "ai_gemini_api_key",
  AI_CLAUDE_API_KEY: "ai_claude_api_key",
  AI_OPENAI_MODEL: "ai_openai_model",
  AI_GROQ_MODEL: "ai_groq_model",
  AI_GEMINI_MODEL: "ai_gemini_model",
  AI_CLAUDE_MODEL: "ai_claude_model",
  AI_OPENAI_ENABLED: "ai_openai_enabled",
  AI_GROQ_ENABLED: "ai_groq_enabled",
  AI_GEMINI_ENABLED: "ai_gemini_enabled",
  AI_CLAUDE_ENABLED: "ai_claude_enabled",
  AI_TASK_ROUTES: "ai_task_routes",
} as const;

/** Platform settings override env for Resend (Super Admin → Settings). */
export async function getResendConfig() {
  const [apiKeyP, fromEmailP, fromNameP, replyToP] = await Promise.all([
    getPlatformSetting(PLATFORM_KEYS.RESEND_API_KEY),
    getPlatformSetting(PLATFORM_KEYS.RESEND_FROM_EMAIL),
    getPlatformSetting(PLATFORM_KEYS.RESEND_FROM_NAME),
    getPlatformSetting(PLATFORM_KEYS.RESEND_REPLY_TO),
  ]);
  return {
    apiKey: (apiKeyP?.trim() || process.env.RESEND_API_KEY || "").trim(),
    fromEmail: (fromEmailP?.trim() || process.env.RESEND_FROM_EMAIL || "").trim(),
    fromName: (fromNameP?.trim() || process.env.RESEND_FROM_NAME || "").trim(),
    replyTo: (replyToP?.trim() || process.env.RESEND_REPLY_TO || "").trim(),
    apiKeySource: apiKeyP?.trim() ? ("platform" as const) : process.env.RESEND_API_KEY ? ("env" as const) : ("none" as const),
    fromEmailSource: fromEmailP?.trim()
      ? ("platform" as const)
      : process.env.RESEND_FROM_EMAIL
        ? ("env" as const)
        : ("none" as const),
  };
}

export async function getPlatformSetting(key: string): Promise<string | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setPlatformSetting(key: string, value: string) {
  return prisma.platformSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Prefer Super Admin toggle; fall back to SHOPIFY_BILLING_TEST env. */
export async function isShopifyBillingTestMode(): Promise<boolean> {
  const stored = await getPlatformSetting(PLATFORM_KEYS.SHOPIFY_BILLING_TEST);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return process.env.SHOPIFY_BILLING_TEST === "true";
}
