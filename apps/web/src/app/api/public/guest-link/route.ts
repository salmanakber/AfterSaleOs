import { NextRequest, NextResponse } from "next/server";
import {
  prisma,
  shopRepository,
  requestGuestMagicLink,
  getPortalWarranties,
  getPortalOrdersForEmail,
  sendTransactionalEmail,
} from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { verifyAppProxySignature, shopDomainFromProxy } from "@/lib/app-proxy";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueEmail } from "@/lib/queue";

export const runtime = "nodejs";

/**
 * Guest portal access: always returns the same public message (anti-enumeration).
 * When email+order match, also returns portal payload so the UI can open immediately
 * (does not wait for email). Email is still attempted when Resend is configured.
 */
export async function POST(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const secret = process.env.SHOPIFY_API_SECRET ?? "";
  if (sp.get("signature") && !verifyAppProxySignature(sp, secret)) {
    return NextResponse.json({ error: "Invalid proxy signature" }, { status: 401 });
  }

  const body = (await request.json()) as { email?: string; orderNumber?: string; shop?: string };
  const shopParam =
    shopDomainFromProxy(sp) ?? body.shop ?? request.headers.get("x-aftersale-shop") ?? sp.get("shop");

  const generic = {
    ok: true as const,
    message: "If we find a matching order, you will receive an email shortly.",
  };

  if (!shopParam || !body.email || !body.orderNumber) {
    return NextResponse.json(generic, { status: 200 });
  }

  const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
  if (!shop) {
    return NextResponse.json(generic, { status: 200 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await rateLimit({
    key: `magic:${shop.id}:${ip}`,
    limit: 8,
    windowSeconds: 900,
  });
  if (!allowed) {
    return NextResponse.json(generic, { status: 200 });
  }

  const result = await requestGuestMagicLink({
    shopId: shop.id,
    email: body.email,
    orderNumber: body.orderNumber,
  });

  if (!result.token) {
    return NextResponse.json(generic, { status: 200 });
  }

  const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const link = `${appUrl}/apps/aftersale/portal?shop=${encodeURIComponent(shop.shopDomain)}&token=${encodeURIComponent(result.token)}`;

  // Prefer direct send so email works even if Redis/worker is down
  let emailSent = false;
  let emailReason: string | undefined;
  try {
    const direct = await sendTransactionalEmail({
      shopId: shop.id,
      to: body.email.trim().toLowerCase(),
      template: "guest_magic_link",
      data: {
        link,
        orderNumber: result.orderNumber,
        shopName: shop.shopName ?? shop.shopDomain,
      },
    });
    emailSent = direct.sent;
    emailReason = direct.reason;
  } catch (err) {
    emailReason = err instanceof Error ? err.message : "send_failed";
    console.warn("direct magic link email failed", err);
  }

  if (!emailSent) {
    try {
      await enqueueEmail({
        shopId: shop.id,
        to: body.email.trim().toLowerCase(),
        template: "guest_magic_link",
        data: {
          link,
          orderNumber: result.orderNumber,
          shopName: shop.shopName ?? shop.shopDomain,
        },
      });
    } catch (err) {
      console.warn("queue magic link email failed", err);
    }
  }

  await prisma.job.updateMany({
    where: {
      shopId: shop.id,
      type: "guest_magic_link",
      status: "PENDING",
    },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      result: { sent: emailSent, reason: emailReason ?? null },
    },
  });

  const warranties = await getPortalWarranties({
    shopId: shop.id,
    email: body.email.trim().toLowerCase(),
    orderNumber: result.orderNumber,
  });
  const orders = await getPortalOrdersForEmail({
    shopId: shop.id,
    email: body.email.trim().toLowerCase(),
  });

  return NextResponse.json({
    ...generic,
    emailSent,
    emailHint: emailSent
      ? "We also emailed you a secure link."
      : emailReason === "missing_resend_api_key" || emailReason === "missing_resend_from_email"
        ? "Email delivery is not configured on the server yet — your portal is open below."
        : "If email is delayed, use the portal below.",
    portal: {
      token: result.token,
      email: body.email.trim().toLowerCase(),
      shopDomain: shop.shopDomain,
      warranties: warranties.map((w) => ({
        id: w.id,
        status: w.status,
        startAt: w.startAt?.toISOString() ?? null,
        endAt: w.endAt?.toISOString() ?? null,
        certificateToken: w.certificateToken,
        productTitle: w.warrantyUnit.orderLineItem.title,
        orderNumber: w.warrantyUnit.orderLineItem.order.orderNumber,
        serialNumber: w.warrantyUnit.serialNumber,
        ruleName: w.ruleVersion.rule.name,
      })),
      orders,
    },
  });
}
