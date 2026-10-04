import { NextRequest, NextResponse } from "next/server";
import { prisma, shopRepository, requestGuestMagicLink } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { verifyAppProxySignature, shopDomainFromProxy } from "@/lib/app-proxy";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueEmail } from "@/lib/queue";

export const runtime = "nodejs";

/**
 * Guest magic link (§4.12): always returns the same message (anti-enumeration).
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
  if (!shopParam || !body.email || !body.orderNumber) {
    // Still generic — don't reveal validation specifics beyond missing fields for UX
    return NextResponse.json(
      { ok: true, message: "If we find a matching order, you will receive an email shortly." },
      { status: 200 },
    );
  }

  const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
  if (!shop) {
    return NextResponse.json(
      { ok: true, message: "If we find a matching order, you will receive an email shortly." },
      { status: 200 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await rateLimit({
    key: `magic:${shop.id}:${ip}`,
    limit: 5,
    windowSeconds: 900,
  });
  if (!allowed) {
    return NextResponse.json(
      { ok: true, message: "If we find a matching order, you will receive an email shortly." },
      { status: 200 },
    );
  }

  await requestGuestMagicLink({
    shopId: shop.id,
    email: body.email,
    orderNumber: body.orderNumber,
  });

  // Send any pending guest_magic_link jobs for this email immediately when possible
  const pending = await prisma.job.findMany({
    where: {
      shopId: shop.id,
      type: "guest_magic_link",
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  for (const job of pending) {
    const payload = job.payload as { email?: string; token?: string; orderNumber?: string } | null;
    if (!payload?.token || payload.email?.toLowerCase() !== body.email.trim().toLowerCase()) continue;
    const link = `${appUrl}/portal/session?token=${encodeURIComponent(payload.token)}&shop=${encodeURIComponent(shop.shopDomain)}`;
    try {
      await enqueueEmail({
        shopId: shop.id,
        to: payload.email!,
        template: "guest_magic_link",
        data: {
          link,
          orderNumber: payload.orderNumber,
          shopName: shop.shopName ?? shop.shopDomain,
        },
      });
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "COMPLETED", finishedAt: new Date(), result: { sent: true } },
      });
    } catch (err) {
      console.warn("magic link email enqueue failed", err);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If we find a matching order, you will receive an email shortly.",
  });
}
