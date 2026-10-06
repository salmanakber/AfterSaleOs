import { prisma } from "../client";
import type { StartDateRule, SerialMode } from "@prisma/client";
import { assertWarrantyRulesQuota } from "../plan-limits";

export type RuleVersionInput = {
  warrantyType: string;
  durationMonths: number | null;
  startDateRule: StartDateRule;
  serialMode: SerialMode;
  gracePeriodDays?: number;
  termsHtml?: string;
  claimCategories?: unknown;
  exclusions?: unknown;
};

export type AssignmentInput = {
  targetType: "variant" | "product" | "collection" | "default";
  targetId?: string | null;
};

export async function createWarrantyRule(params: {
  shopId: string;
  name: string;
  priority?: number;
  version: RuleVersionInput;
  assignments: AssignmentInput[];
}) {
  await assertWarrantyRulesQuota(params.shopId);

  const rule = await prisma.warrantyRule.create({
    data: {
      shopId: params.shopId,
      name: params.name,
      priority: params.priority ?? 100,
      active: true,
    },
  });

  const version = await prisma.warrantyRuleVersion.create({
    data: {
      shopId: params.shopId,
      ruleId: rule.id,
      version: 1,
      warrantyType: params.version.warrantyType,
      durationMonths: params.version.durationMonths,
      startDateRule: params.version.startDateRule,
      serialMode: params.version.serialMode,
      gracePeriodDays: params.version.gracePeriodDays ?? 0,
      termsHtml: params.version.termsHtml,
      claimCategories: params.version.claimCategories as object | undefined,
      exclusions: params.version.exclusions as object | undefined,
    },
  });

  await prisma.warrantyRule.update({
    where: { id: rule.id },
    data: { currentVersionId: version.id },
  });

  if (params.assignments.length === 0) {
    await prisma.ruleAssignment.create({
      data: { shopId: params.shopId, ruleId: rule.id, targetType: "default", targetId: null },
    });
  } else {
    for (const a of params.assignments) {
      await prisma.ruleAssignment.create({
        data: {
          shopId: params.shopId,
          ruleId: rule.id,
          targetType: a.targetType,
          targetId: a.targetType === "default" ? null : a.targetId ?? null,
        },
      });
    }
  }

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      action: "warranty_rule.created",
      entityType: "warranty_rule",
      entityId: rule.id,
      after: { name: rule.name, versionId: version.id },
    },
  });

  return getWarrantyRule(params.shopId, rule.id);
}

export async function publishRuleVersion(params: {
  shopId: string;
  ruleId: string;
  version: RuleVersionInput;
}) {
  const rule = await prisma.warrantyRule.findFirst({
    where: { id: params.ruleId, shopId: params.shopId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!rule) throw new Error("Rule not found");

  const nextVersion = (rule.versions[0]?.version ?? 0) + 1;
  const version = await prisma.warrantyRuleVersion.create({
    data: {
      shopId: params.shopId,
      ruleId: rule.id,
      version: nextVersion,
      warrantyType: params.version.warrantyType,
      durationMonths: params.version.durationMonths,
      startDateRule: params.version.startDateRule,
      serialMode: params.version.serialMode,
      gracePeriodDays: params.version.gracePeriodDays ?? 0,
      termsHtml: params.version.termsHtml,
      claimCategories: params.version.claimCategories as object | undefined,
      exclusions: params.version.exclusions as object | undefined,
    },
  });

  await prisma.warrantyRule.update({
    where: { id: rule.id },
    data: { currentVersionId: version.id },
  });

  await prisma.activityLog.create({
    data: {
      shopId: params.shopId,
      actorType: "staff",
      action: "warranty_rule.version_published",
      entityType: "warranty_rule",
      entityId: rule.id,
      after: { versionId: version.id, version: nextVersion },
    },
  });

  return getWarrantyRule(params.shopId, rule.id);
}

export async function getWarrantyRule(shopId: string, ruleId: string) {
  return prisma.warrantyRule.findFirst({
    where: { id: ruleId, shopId },
    include: {
      versions: { orderBy: { version: "desc" } },
      assignments: true,
    },
  });
}

export async function listWarrantyRules(shopId: string) {
  return prisma.warrantyRule.findMany({
    where: { shopId },
    orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "desc" }],
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      assignments: true,
    },
  });
}

export async function updateRuleMeta(params: {
  shopId: string;
  ruleId: string;
  name?: string;
  priority?: number;
  active?: boolean;
  assignments?: AssignmentInput[];
}) {
  const rule = await prisma.warrantyRule.findFirst({
    where: { id: params.ruleId, shopId: params.shopId },
  });
  if (!rule) throw new Error("Rule not found");

  await prisma.warrantyRule.update({
    where: { id: rule.id },
    data: {
      name: params.name,
      priority: params.priority,
      active: params.active,
    },
  });

  if (params.assignments) {
    await prisma.ruleAssignment.deleteMany({ where: { ruleId: rule.id, shopId: params.shopId } });
    for (const a of params.assignments) {
      await prisma.ruleAssignment.create({
        data: {
          shopId: params.shopId,
          ruleId: rule.id,
          targetType: a.targetType,
          targetId: a.targetType === "default" ? null : a.targetId ?? null,
        },
      });
    }
  }

  return getWarrantyRule(params.shopId, rule.id);
}
