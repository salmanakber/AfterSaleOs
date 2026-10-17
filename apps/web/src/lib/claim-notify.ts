import { prisma } from "@aftersale/db";
import { enqueueEmail } from "@/lib/queue";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_REVIEW: "Under review",
  WAITING_CUSTOMER: "Waiting on you",
  APPROVED: "Approved",
  REJECTED: "Not approved",
  IN_RESOLUTION: "Being resolved",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function appBase() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://aftersale.tidyflowapp.com").replace(
    /\/$/,
    "",
  );
}

function trackingUrl(publicToken: string, shopDomain: string) {
  return `${appBase()}/apps/aftersale/claim/${publicToken}?shop=${encodeURIComponent(shopDomain)}`;
}

/** Email customer when claim status changes (or a customer-visible note is posted). */
export async function notifyClaimStatus(params: {
  shopId: string;
  claimId: string;
  status: string;
  note?: string | null;
  event?: "status" | "note" | "resolution";
  resolutionKind?: "refund" | "replacement" | "repair";
}) {
  const claim = await prisma.claim.findFirst({
    where: { id: params.claimId, shopId: params.shopId },
    include: {
      shop: true,
      warrantyUnit: { include: { orderLineItem: true } },
    },
  });
  if (!claim?.customerEmail) return;

  const statusLabel = STATUS_LABEL[params.status] ?? params.status.replaceAll("_", " ");
  const productTitle = claim.warrantyUnit?.orderLineItem.title ?? null;
  const track = trackingUrl(claim.publicToken, claim.shop.shopDomain);
  const shopName = claim.shop.shopName ?? claim.shop.shopDomain;

  let template = `claim_status_${params.status.toLowerCase()}`;
  if (params.event === "note") template = "claim_customer_note";
  if (params.event === "resolution") {
    template = params.resolutionKind
      ? `claim_resolution_${params.resolutionKind}`
      : "claim_status_in_resolution";
  }

  await enqueueEmail({
    shopId: params.shopId,
    to: claim.customerEmail,
    template,
    data: {
      claimNumber: claim.claimNumber,
      status: params.status,
      statusLabel,
      note: params.note ?? "",
      summary: claim.issueSummary,
      productTitle,
      trackingUrl: track,
      shopName,
      resolutionKind: params.resolutionKind ?? "",
    },
  });
}
