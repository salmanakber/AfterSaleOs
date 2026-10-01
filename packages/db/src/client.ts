import { PrismaClient } from "@prisma/client";

// Next.js page-data collection imports this module without runtime env.
// Provide a dummy URL only for production builds so Prisma can construct;
// no queries should run at build time (session storage is lazy).
if (
  !process.env.DATABASE_URL &&
  (process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build")
) {
  process.env.DATABASE_URL =
    "postgresql://build:build@127.0.0.1:5432/aftersale_build?schema=public";
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
