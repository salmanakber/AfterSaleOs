import { createHmac, timingSafeEqual } from "crypto";
import { embeddedAdminAppUrl } from "@/lib/shopify/embedded-url";

function secret() {
  return (
    process.env.STAFF_INVITE_SECRET ||
    process.env.SHOPIFY_API_SECRET ||
    process.env.SESSION_SECRET ||
    "aftersale-staff-invite"
  );
}

export type StaffInvitePayload = {
  staffId: string;
  shopId: string;
  email: string;
  /** Issued-at unix seconds — rotating “unique” links */
  iat: number;
  nonce: string;
};

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

function sign(payloadB64: string) {
  return b64url(createHmac("sha256", secret()).update(payloadB64).digest());
}

/** Create a unique invite token for a staff member (new nonce each call). */
export function mintStaffInviteToken(input: {
  staffId: string;
  shopId: string;
  email: string;
  nonce?: string;
}): string {
  const payload: StaffInvitePayload = {
    staffId: input.staffId,
    shopId: input.shopId,
    email: input.email.trim().toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
    nonce: input.nonce || b64url(Buffer.from(`${Date.now()}-${Math.random()}`)),
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyStaffInviteToken(token: string): StaffInvitePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(fromB64url(body)) as StaffInvitePayload;
    if (!parsed.staffId || !parsed.shopId || !parsed.email) return null;
    // Links older than 180 days expire
    if (parsed.iat && Date.now() / 1000 - parsed.iat > 180 * 24 * 3600) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function staffInvitePublicUrl(token: string) {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `${base}/staff/join?t=${encodeURIComponent(token)}`;
}

export function staffWorkspaceAdminUrl(shopDomain: string) {
  return embeddedAdminAppUrl({
    path: "/",
    shop: shopDomain,
    apiKey: process.env.SHOPIFY_API_KEY || process.env.NEXT_PUBLIC_SHOPIFY_API_KEY,
  });
}
