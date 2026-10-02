import {
  addSerialNumbers,
  createQrLink,
  createSerialList,
  linkSerialListToRule,
  listNotificationTemplates,
  listQrLinks,
  listSerialLists,
  listStaffMembers,
  qrPublicUrl,
  setQrLinkActive,
  shopPlanFeatures,
  upsertNotificationTemplate,
  upsertStaffMember,
  updateWorkflowStatusLabel,
} from "@aftersale/db";
import { resolveMerchantContext } from "@/lib/auth/merchant";

export const merchantOpsTypeDefs = /* GraphQL */ `
  type QrLinkItem {
    id: ID!
    code: String!
    url: String!
    targetType: String!
    targetId: String
    label: String
    scanCount: Int!
    active: Boolean!
    createdAt: String!
  }

  type StaffMemberItem {
    id: ID!
    email: String!
    name: String
    role: String!
    active: Boolean!
    createdAt: String!
  }

  type SerialListItem {
    id: ID!
    name: String!
    ruleId: String
    entryCount: Int!
    createdAt: String!
  }

  type NotificationTemplateItem {
    id: ID!
    key: String!
    subject: String
    bodyHtml: String!
    active: Boolean!
    isPlatformDefault: Boolean!
  }

  extend type Query {
    qrLinks: [QrLinkItem!]!
    staffMembers: [StaffMemberItem!]!
    serialLists: [SerialListItem!]!
    notificationTemplates: [NotificationTemplateItem!]!
  }

  extend type Mutation {
    createQrLink(targetType: String, targetId: String, label: String): QrLinkItem!
    setQrLinkActive(id: ID!, active: Boolean!): QrLinkItem!
    upsertStaffMember(
      id: ID
      email: String!
      name: String
      role: String
      active: Boolean
    ): StaffMemberItem!
    createSerialList(name: String!, ruleId: ID): SerialListItem!
    addSerialNumbers(serialListId: ID!, serials: [String!]!): AddSerialsResult!
    linkSerialListToRule(serialListId: ID!, ruleId: ID): SerialListItem!
    upsertNotificationTemplate(key: String!, subject: String!, bodyHtml: String!): NotificationTemplateItem!
    updateWorkflowStatusLabel(statusId: ID!, label: String!): WorkflowStatusItem!
  }

  type AddSerialsResult {
    added: Int!
    submitted: Int!
  }
`;

async function merchant(ctx: { request: Request }) {
  return resolveMerchantContext(ctx.request);
}

export const merchantOpsResolvers = {
  Query: {
    qrLinks: async (_: unknown, __: unknown, ctx: { request: Request }) => {
      const m = await merchant(ctx);
      const rows = await listQrLinks(m.shopId);
      return rows.map((r) => ({
        ...r,
        url: qrPublicUrl(r.code),
        createdAt: r.createdAt.toISOString(),
      }));
    },
    staffMembers: async (_: unknown, __: unknown, ctx: { request: Request }) => {
      const m = await merchant(ctx);
      const rows = await listStaffMembers(m.shopId);
      return rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: r.role,
        active: r.active,
        createdAt: r.createdAt.toISOString(),
      }));
    },
    serialLists: async (_: unknown, __: unknown, ctx: { request: Request }) => {
      const m = await merchant(ctx);
      const rows = await listSerialLists(m.shopId);
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        ruleId: r.ruleId,
        entryCount: r._count.entries,
        createdAt: r.createdAt.toISOString(),
      }));
    },
    notificationTemplates: async (_: unknown, __: unknown, ctx: { request: Request }) => {
      const m = await merchant(ctx);
      const rows = await listNotificationTemplates(m.shopId);
      return rows.map((r) => ({
        id: r.id,
        key: r.key,
        subject: r.subject,
        bodyHtml: r.bodyHtml,
        active: r.active,
        isPlatformDefault: r.shopId == null,
      }));
    },
  },
  Mutation: {
    createQrLink: async (
      _: unknown,
      args: { targetType?: string; targetId?: string; label?: string },
      ctx: { request: Request },
    ) => {
      const m = await merchant(ctx);
      const plan = await shopPlanFeatures(m.shopId);
      if (plan && !plan.qrCodes) {
        throw new Error("QR codes are not included on your current plan. Upgrade to enable.");
      }
      const link = await createQrLink({
        shopId: m.shopId,
        targetType: args.targetType,
        targetId: args.targetId ?? null,
        label: args.label ?? null,
      });
      return {
        ...link,
        url: qrPublicUrl(link.code),
        createdAt: link.createdAt.toISOString(),
      };
    },
    setQrLinkActive: async (
      _: unknown,
      args: { id: string; active: boolean },
      ctx: { request: Request },
    ) => {
      const m = await merchant(ctx);
      const link = await setQrLinkActive(m.shopId, args.id, args.active);
      return {
        ...link,
        url: qrPublicUrl(link.code),
        createdAt: link.createdAt.toISOString(),
      };
    },
    upsertStaffMember: async (
      _: unknown,
      args: {
        id?: string;
        email: string;
        name?: string;
        role?: string;
        active?: boolean;
      },
      ctx: { request: Request },
    ) => {
      const m = await merchant(ctx);
      const plan = await shopPlanFeatures(m.shopId);
      const limit = plan?.staffSeats ?? 1;
      const row = await upsertStaffMember({
        shopId: m.shopId,
        id: args.id,
        email: args.email,
        name: args.name ?? null,
        role: args.role,
        active: args.active,
        staffSeatsLimit: limit,
      });
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        active: row.active,
        createdAt: row.createdAt.toISOString(),
      };
    },
    createSerialList: async (
      _: unknown,
      args: { name: string; ruleId?: string },
      ctx: { request: Request },
    ) => {
      const m = await merchant(ctx);
      const list = await createSerialList(m.shopId, args.name, args.ruleId ?? null);
      return {
        id: list.id,
        name: list.name,
        ruleId: list.ruleId,
        entryCount: 0,
        createdAt: list.createdAt.toISOString(),
      };
    },
    addSerialNumbers: async (
      _: unknown,
      args: { serialListId: string; serials: string[] },
      ctx: { request: Request },
    ) => {
      const m = await merchant(ctx);
      const result = await addSerialNumbers({
        shopId: m.shopId,
        serialListId: args.serialListId,
        serials: args.serials,
      });
      return { added: result.added, submitted: result.total };
    },
    linkSerialListToRule: async (
      _: unknown,
      args: { serialListId: string; ruleId: string },
      ctx: { request: Request },
    ) => {
      const m = await merchant(ctx);
      const list = await linkSerialListToRule({
        shopId: m.shopId,
        serialListId: args.serialListId,
        ruleId: args.ruleId,
      });
      const count = await listSerialLists(m.shopId);
      const entryCount = count.find((c) => c.id === list.id)?._count.entries ?? 0;
      return {
        id: list.id,
        name: list.name,
        ruleId: list.ruleId,
        entryCount,
        createdAt: list.createdAt.toISOString(),
      };
    },
    upsertNotificationTemplate: async (
      _: unknown,
      args: { key: string; subject: string; bodyHtml: string },
      ctx: { request: Request },
    ) => {
      const m = await merchant(ctx);
      const row = await upsertNotificationTemplate({
        shopId: m.shopId,
        key: args.key,
        subject: args.subject,
        bodyHtml: args.bodyHtml,
      });
      return {
        id: row.id,
        key: row.key,
        subject: row.subject,
        bodyHtml: row.bodyHtml,
        active: row.active,
        isPlatformDefault: false,
      };
    },
    updateWorkflowStatusLabel: async (
      _: unknown,
      args: { statusId: string; label: string },
      ctx: { request: Request },
    ) => {
      const m = await merchant(ctx);
      const row = await updateWorkflowStatusLabel({
        shopId: m.shopId,
        statusId: args.statusId,
        label: args.label,
      });
      return {
        id: row.id,
        key: row.key,
        label: row.label,
        systemState: row.systemState,
        sortOrder: row.sortOrder,
        emailTemplateKey: row.emailTemplateKey,
      };
    },
  },
};
