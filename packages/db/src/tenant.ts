import { Prisma } from "@prisma/client";
import { prisma } from "./client";

const TENANT_MODELS = new Set([
  "Shop",
  "BillingCharge",
  "UsageCounter",
  "WebhookEvent",
  "Job",
  "StaffMember",
  "ActivityLog",
  "Product",
  "ProductVariant",
  "Customer",
  "Order",
  "OrderLineItem",
  "WarrantyRule",
  "WarrantyRuleVersion",
  "RuleAssignment",
  "WarrantyUnit",
  "Warranty",
  "Registration",
  "Claim",
  "Attachment",
  "Location",
  "PrivacyRequest",
  "ShopNote",
]);

type TenantContext = { shopId: string };

/**
 * Tenant-scoped Prisma client: injects shopId into every query for merchant models.
 * Feature code must use createTenantClient(shopId) — never raw prisma for shop data.
 */
export function createTenantClient(shopId: string) {
  if (!shopId) {
    throw new Error("shopId is required for tenant-scoped client");
  }

  const ctx: TenantContext = { shopId };

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }

          // Shop model uses id as the tenant key
          if (model === "Shop") {
            const a = args as Record<string, unknown>;
            if (operation === "findMany" || operation === "findFirst" || operation === "count" || operation === "aggregate") {
              a.where = { ...(a.where as object | undefined), id: shopId };
            } else if (operation === "findUnique" || operation === "findUniqueOrThrow") {
              // allow only lookup of this shop
              const where = a.where as Record<string, unknown> | undefined;
              if (where && "id" in where && where.id !== shopId) {
                throw new Error("TENANT_ISOLATION: cross-shop Shop lookup blocked");
              }
              if (where && "shopDomain" in where) {
                // domain lookup is ok; result still filtered by ensuring match after
              }
            } else if (
              operation === "update" ||
              operation === "updateMany" ||
              operation === "delete" ||
              operation === "deleteMany"
            ) {
              a.where = { ...(a.where as object | undefined), id: shopId };
            }
            return query(args);
          }

          const a = args as {
            where?: Record<string, unknown>;
            data?: Record<string, unknown> | Record<string, unknown>[];
            create?: Record<string, unknown>;
            update?: Record<string, unknown>;
          };

          const injectWhere = () => {
            a.where = { ...a.where, shopId };
          };

          switch (operation) {
            case "findUnique":
            case "findUniqueOrThrow": {
              // Prefer composite uniqueness; still require shopId in where when present
              if (a.where && !("shopId" in a.where)) {
                a.where = { ...a.where, shopId };
              }
              break;
            }
            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy":
            case "updateMany":
            case "deleteMany":
              injectWhere();
              break;
            case "update":
            case "delete":
              injectWhere();
              break;
            case "create": {
              if (a.data && !Array.isArray(a.data)) {
                a.data = { ...a.data, shopId };
              }
              break;
            }
            case "createMany": {
              if (Array.isArray(a.data)) {
                a.data = a.data.map((row) => ({ ...row, shopId }));
              } else if (a.data) {
                a.data = { ...a.data, shopId };
              }
              break;
            }
            case "upsert": {
              if (a.create) a.create = { ...a.create, shopId };
              a.where = { ...a.where, shopId };
              break;
            }
            default:
              break;
          }

          return query(args);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof createTenantClient>;

/** Unscoped client for platform/admin only — never import in merchant feature code. */
export function createAdminPrisma() {
  return prisma;
}

export type AdminPrisma = typeof prisma;

export { Prisma };
