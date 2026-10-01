export const QUEUE_NAMES = {
  WEBHOOKS: "webhooks",
  EMAILS: "emails",
  BACKFILL: "backfill",
  PDF: "pdf",
  AI: "ai",
  CAMPAIGNS: "campaigns",
  BULK: "bulk",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export function normalizeShopDomain(shop: string): string {
  return shop
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export function offlineSessionId(shop: string): string {
  return `offline_${normalizeShopDomain(shop)}`;
}
