import { NextRequest, NextResponse } from "next/server";
import {
  shopRepository,
  createClaim,
  prisma,
  saveClaimAttachment,
} from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { verifyAppProxySignature, shopDomainFromProxy } from "@/lib/app-proxy";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueEmail } from "@/lib/queue";

export const runtime = "nodejs";

async function resolveShop(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const secret = process.env.SHOPIFY_API_SECRET ?? "";
  if (sp.get("signature") && !verifyAppProxySignature(sp, secret)) {
    return { error: NextResponse.json({ error: "Invalid proxy signature" }, { status: 401 }) };
  }
  const shopParam =
    shopDomainFromProxy(sp) ?? request.headers.get("x-aftersale-shop") ?? sp.get("shop");
  if (!shopParam) return { error: NextResponse.json({ error: "Missing shop" }, { status: 400 }) };
  const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
  if (!shop || shop.status === "UNINSTALLED") {
    return { error: NextResponse.json({ error: "Shop not found" }, { status: 404 }) };
  }
  return { shop };
}

/** POST JSON claim submission */
export async function POST(request: NextRequest) {
  const resolved = await resolveShop(request);
  if ("error" in resolved) return resolved.error;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await rateLimit({
    key: `claim:${resolved.shop.id}:${ip}`,
    limit: 8,
    windowSeconds: 600,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as {
    email?: string;
    customerName?: string;
    certificateToken?: string;
    orderNumber?: string;
    serialNumber?: string;
    warrantyId?: string;
    issueCategory?: string;
    issueSummary?: string;
    issueDetails?: string;
    attachmentIds?: string[];
  };

  if (!body.email || !body.issueSummary) {
    return NextResponse.json({ error: "Email and issue summary are required" }, { status: 400 });
  }

  const { claim, eligibility } = await createClaim({
    shopId: resolved.shop.id,
    email: body.email,
    customerName: body.customerName,
    certificateToken: body.certificateToken,
    orderNumber: body.orderNumber,
    serialNumber: body.serialNumber,
    warrantyId: body.warrantyId,
    issueCategory: body.issueCategory,
    issueSummary: body.issueSummary,
    issueDetails: body.issueDetails,
    attachmentIds: body.attachmentIds,
  });

  const trackingUrl = `https://${resolved.shop.shopDomain}/apps/aftersale/claim/${claim.publicToken}`;
  await enqueueEmail({
    shopId: resolved.shop.id,
    to: body.email,
    template: "claim_created",
    data: {
      claimNumber: claim.claimNumber,
      trackingUrl,
      eligibility: eligibility.outcome,
    },
  });

  return NextResponse.json({
    ok: true,
    claimNumber: claim.claimNumber,
    publicToken: claim.publicToken,
    trackingUrl,
    eligibility: eligibility.outcome,
    message:
      "Your claim was submitted. Eligibility is a guide for the merchant — this is not an automatic rejection.",
  });
}

/** GET claim by public token */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const claim = await prisma.claim.findUnique({
    where: { publicToken: token },
    include: {
      shop: true,
      notes: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
      },
      attachments: true,
      warrantyUnit: { include: { orderLineItem: true } },
    },
  });
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

  return NextResponse.json({
    claimNumber: claim.claimNumber,
    status: claim.status,
    issueSummary: claim.issueSummary,
    issueDetails: claim.issueDetails,
    issueCategory: claim.issueCategory,
    eligibilityResult: claim.eligibilityResult,
    eligibilityOverride: claim.eligibilityOverride,
    productTitle: claim.warrantyUnit?.orderLineItem.title ?? null,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    shopName: claim.shop.shopName ?? claim.shop.shopDomain,
    notes: claim.notes.map((n) => ({
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      authorType: n.authorType,
    })),
    attachments: claim.attachments.map((a) => ({
      fileName: a.fileName,
      contentType: a.contentType,
    })),
  });
}
