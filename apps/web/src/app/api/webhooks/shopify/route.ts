import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { shopify } from "@/lib/shopify/client";
import { enqueueWebhookProcessing } from "@/lib/queue";
import {
  handleAppUninstalled,
  handleCustomersDataRequest,
  handleCustomersRedact,
  handleShopRedact,
} from "@/lib/compliance";

export const runtime = "nodejs";

/**
 * Webhook ingestion: verify HMAC → idempotent insert → 200 → enqueue.
 * Long work happens in the worker.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const topic = request.headers.get("x-shopify-topic") ?? "";
  const shopDomain = normalizeShopDomain(request.headers.get("x-shopify-shop-domain") ?? "");
  const eventId =
    request.headers.get("x-shopify-event-id") ??
    request.headers.get("x-shopify-webhook-id") ??
    `${topic}:${shopDomain}:${Buffer.from(rawBody).toString("base64url").slice(0, 32)}`;

  const validation = await shopify.webhooks.validate({
    rawBody,
    rawRequest: request as unknown as Request,
    rawResponse: undefined,
  }).catch(async () => {
    // Manual HMAC fallback for App Router
    const hmac = request.headers.get("x-shopify-hmac-sha256");
    const secret = process.env.SHOPIFY_API_SECRET ?? "";
    if (!hmac || !secret) return { valid: false };
    const crypto = await import("crypto");
    const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
    const valid = crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
    return { valid };
  });

  // shopify.webhooks.validate may return differently; normalize
  const valid =
    typeof validation === "object" && validation && "valid" in validation
      ? Boolean((validation as { valid: boolean }).valid)
      : false;

  // Re-check with manual HMAC if library path failed in Next edge cases
  let hmacOk = valid;
  if (!hmacOk) {
    const hmac = request.headers.get("x-shopify-hmac-sha256");
    const secret = process.env.SHOPIFY_API_SECRET ?? "";
    if (hmac && secret) {
      const crypto = await import("crypto");
      const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
      try {
        hmacOk = crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
      } catch {
        hmacOk = false;
      }
    }
  }

  if (!hmacOk) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  let payload: unknown = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { raw: rawBody };
  }

  // Compliance + uninstall handled immediately (must acknowledge + act)
  if (topic === "customers/data_request") {
    await handleCustomersDataRequest(shopDomain, payload);
    return NextResponse.json({ ok: true });
  }
  if (topic === "customers/redact") {
    await handleCustomersRedact(shopDomain, payload as Parameters<typeof handleCustomersRedact>[1]);
    return NextResponse.json({ ok: true });
  }
  if (topic === "shop/redact") {
    await handleShopRedact(shopDomain);
    return NextResponse.json({ ok: true });
  }
  if (topic === "app/uninstalled") {
    await handleAppUninstalled(shopDomain);
    return NextResponse.json({ ok: true });
  }

  const shop = shopDomain ? await shopRepository.findByDomain(shopDomain) : null;

  try {
    const event = await prisma.webhookEvent.create({
      data: {
        shopId: shop?.id,
        shopDomain: shopDomain || "unknown",
        topic,
        eventId,
        payload: payload as object,
        status: "PENDING",
      },
    });
    await enqueueWebhookProcessing(event.id);
  } catch (err: unknown) {
    // Unique violation = already processed (idempotent)
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
