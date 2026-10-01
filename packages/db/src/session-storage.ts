import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { prisma } from "./client";

export const shopifySessionStorage = new PrismaSessionStorage(prisma, {
  tableName: "Session",
});
