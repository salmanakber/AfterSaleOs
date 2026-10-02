import { randomBytes } from "crypto";
import { prisma } from "./client";

const APP_URL = () => process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function listQrLinks(shopId: string) {
  return prisma.qrLink.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createQrLink(params: {
  shopId: string;
  targetType?: string;
  targetId?: string | null;
  label?: string | null;
}) {
  const code = randomBytes(5).toString("base64url");
  return prisma.qrLink.create({
    data: {
      shopId: params.shopId,
      code,
      targetType: params.targetType ?? "product",
      targetId: params.targetId ?? null,
      label: params.label ?? null,
    },
  });
}

export async function setQrLinkActive(shopId: string, id: string, active: boolean) {
  const link = await prisma.qrLink.findFirst({ where: { id, shopId } });
  if (!link) throw new Error("QR link not found");
  return prisma.qrLink.update({ where: { id }, data: { active } });
}

export function qrPublicUrl(code: string) {
  const base = APP_URL().replace(/\/$/, "");
  return `${base}/q/${code}`;
}

export async function listStaffMembers(shopId: string) {
  return prisma.staffMember.findMany({
    where: { shopId },
    orderBy: { createdAt: "asc" },
  });
}

export async function upsertStaffMember(params: {
  shopId: string;
  id?: string;
  email: string;
  name?: string | null;
  role?: string;
  active?: boolean;
  staffSeatsLimit: number;
}) {
  const email = params.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  if (params.id) {
    const existing = await prisma.staffMember.findFirst({
      where: { id: params.id, shopId: params.shopId },
    });
    if (!existing) throw new Error("Staff member not found");
    return prisma.staffMember.update({
      where: { id: existing.id },
      data: {
        email,
        name: params.name ?? undefined,
        role: (params.role as never) ?? undefined,
        active: params.active ?? undefined,
      },
    });
  }

  const activeCount = await prisma.staffMember.count({
    where: { shopId: params.shopId, active: true },
  });
  if (activeCount >= params.staffSeatsLimit) {
    throw new Error(`Staff seat limit reached (${params.staffSeatsLimit}). Upgrade your plan.`);
  }

  return prisma.staffMember.upsert({
    where: { shopId_email: { shopId: params.shopId, email } },
    create: {
      shopId: params.shopId,
      email,
      name: params.name ?? null,
      role: (params.role as never) ?? "SUPPORT_AGENT",
      active: params.active ?? true,
    },
    update: {
      name: params.name ?? undefined,
      role: (params.role as never) ?? undefined,
      active: params.active ?? true,
    },
  });
}

export async function listSerialLists(shopId: string) {
  return prisma.serialList.findMany({
    where: { shopId },
    include: { _count: { select: { entries: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSerialList(shopId: string, name: string, ruleId?: string | null) {
  if (!name.trim()) throw new Error("List name is required");
  return prisma.serialList.create({
    data: { shopId, name: name.trim(), ruleId: ruleId ?? null },
  });
}

/** Attach one serial list to a rule (clears other lists pointing at the same rule). */
export async function linkSerialListToRule(params: {
  shopId: string;
  serialListId: string;
  ruleId: string | null;
}) {
  const list = await prisma.serialList.findFirst({
    where: { id: params.serialListId, shopId: params.shopId },
  });
  if (!list) throw new Error("Serial list not found");

  if (params.ruleId) {
    const rule = await prisma.warrantyRule.findFirst({
      where: { id: params.ruleId, shopId: params.shopId },
    });
    if (!rule) throw new Error("Rule not found");
    await prisma.serialList.updateMany({
      where: {
        shopId: params.shopId,
        ruleId: params.ruleId,
        NOT: { id: params.serialListId },
      },
      data: { ruleId: null },
    });
  }

  return prisma.serialList.update({
    where: { id: list.id },
    data: { ruleId: params.ruleId },
  });
}

export async function addSerialNumbers(params: {
  shopId: string;
  serialListId: string;
  serials: string[];
}) {
  const list = await prisma.serialList.findFirst({
    where: { id: params.serialListId, shopId: params.shopId },
  });
  if (!list) throw new Error("Serial list not found");

  const cleaned = [...new Set(params.serials.map((s) => s.trim()).filter(Boolean))];
  if (cleaned.length === 0) throw new Error("No serial numbers provided");

  let added = 0;
  for (const serial of cleaned) {
    try {
      await prisma.serialNumber.create({
        data: { shopId: params.shopId, serialListId: list.id, serial },
      });
      added += 1;
    } catch {
      // unique violation — skip duplicate
    }
  }
  return { added, total: cleaned.length };
}

export async function listNotificationTemplates(shopId: string) {
  return prisma.notificationTemplate.findMany({
    where: { OR: [{ shopId }, { shopId: null }] },
    orderBy: [{ shopId: "desc" }, { key: "asc" }],
  });
}

export async function upsertNotificationTemplate(params: {
  shopId: string;
  key: string;
  subject: string;
  bodyHtml: string;
}) {
  return prisma.notificationTemplate.upsert({
    where: {
      shopId_key_channel: { shopId: params.shopId, key: params.key, channel: "email" },
    },
    create: {
      shopId: params.shopId,
      key: params.key,
      channel: "email",
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      active: true,
    },
    update: {
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      active: true,
    },
  });
}

export async function getNotificationTemplateForSend(shopId: string, key: string) {
  const shopTpl = await prisma.notificationTemplate.findUnique({
    where: { shopId_key_channel: { shopId, key, channel: "email" } },
  });
  if (shopTpl?.active) return shopTpl;
  const platform = await prisma.notificationTemplate.findFirst({
    where: { shopId: null, key, channel: "email", active: true },
  });
  return platform;
}

export async function updateWorkflowStatusLabel(params: {
  shopId: string;
  statusId: string;
  label: string;
}) {
  const status = await prisma.workflowStatus.findFirst({
    where: { id: params.statusId, shopId: params.shopId },
  });
  if (!status) throw new Error("Workflow status not found");
  return prisma.workflowStatus.update({
    where: { id: status.id },
    data: { label: params.label.trim() || status.label },
  });
}

export async function shopPlanFeatures(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { plan: true },
  });
  return shop?.plan ?? null;
}
