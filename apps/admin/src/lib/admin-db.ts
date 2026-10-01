import { createAdminPrisma, prisma } from "@aftersale/db";

/**
 * Audited admin client wrapper (§6B).
 * Every mutating action should call audit() with reason.
 */
export const adminPrisma = createAdminPrisma();

export async function audit(params: {
  adminUserId?: string;
  action: string;
  shopId?: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: params.adminUserId,
      action: params.action,
      shopId: params.shopId,
      reason: params.reason,
      before: params.before as object | undefined,
      after: params.after as object | undefined,
      meta: params.meta as object | undefined,
    },
  });
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}
