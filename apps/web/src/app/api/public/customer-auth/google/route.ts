import { NextRequest, NextResponse } from "next/server";
import {
  getPortalOrdersForEmail,
  getPortalWarranties,
  shopRepository,
} from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { withPublicCors, publicCorsPreflight } from "@/lib/public-cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return publicCorsPreflight(request.headers.get("origin"));
}

type GoogleTokenInfo = {
  email?: string;
  email_verified?: string | boolean;
  aud?: string;
  iss?: string;
};

/**
 * Verify a Google Identity Services ID token, then open a portal session by email.
 * Requires GOOGLE_CLIENT_ID (or NEXT_PUBLIC_GOOGLE_CLIENT_ID) on the server.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try {
    const body = (await request.json()) as { shop?: string; credential?: string };
    const clientId =
      process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    if (!clientId) {
      return withPublicCors(
        NextResponse.json({ error: "Google sign-in is not configured for this app." }, { status: 503 }),
        origin,
      );
    }
    if (!body.shop || !body.credential) {
      return withPublicCors(
        NextResponse.json({ error: "shop and credential required" }, { status: 400 }),
        origin,
      );
    }

    const shop = await shopRepository.findByDomain(normalizeShopDomain(body.shop));
    if (!shop || shop.status === "UNINSTALLED") {
      return withPublicCors(NextResponse.json({ error: "Shop not found" }, { status: 404 }), origin);
    }

    const tokenRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(body.credential)}`,
    );
    if (!tokenRes.ok) {
      return withPublicCors(
        NextResponse.json({ error: "Invalid Google credential" }, { status: 401 }),
        origin,
      );
    }
    const info = (await tokenRes.json()) as GoogleTokenInfo;
    const verified = info.email_verified === true || info.email_verified === "true";
    if (!info.email || !verified || info.aud !== clientId) {
      return withPublicCors(
        NextResponse.json({ error: "Google account email could not be verified" }, { status: 401 }),
        origin,
      );
    }

    const email = info.email.trim().toLowerCase();
    const [orders, warranties] = await Promise.all([
      getPortalOrdersForEmail({ shopId: shop.id, email }),
      getPortalWarranties({ shopId: shop.id, email }),
    ]);

    return withPublicCors(
      NextResponse.json({
        email,
        orders,
        warranties: warranties.map((w) => ({
          id: w.id,
          status: w.status,
          productTitle: w.warrantyUnit.orderLineItem.title,
          orderNumber: w.warrantyUnit.orderLineItem.order.orderNumber,
          serialNumber: w.warrantyUnit.serialNumber,
          certificateToken: w.certificateToken,
          startAt: w.startAt?.toISOString() ?? null,
          endAt: w.endAt?.toISOString() ?? null,
          ruleName: w.ruleVersion.rule.name,
        })),
        source: "google",
      }),
      origin,
    );
  } catch (err) {
    return withPublicCors(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "Sign-in failed" },
        { status: 500 },
      ),
      origin,
    );
  }
}
