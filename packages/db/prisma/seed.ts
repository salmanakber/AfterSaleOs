import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLAN_DEFS = [
  {
    name: "Free",
    slug: "free",
    priceMonthlyCents: 0,
    isFree: true,
    shopifyPlanName: "Free",
    warrantiesPerMonth: 50,
    claimsPerMonth: 10,
    attachmentStorageMb: 1024,
    staffSeats: 1,
    aiCreditsPerMonth: 10,
    warrantyRulesLimit: 3,
    locationsLimit: 1,
    technicianAccounts: 0,
    publicApiEnabled: false,
    sortOrder: 0,
  },
  {
    name: "Starter",
    slug: "starter",
    priceMonthlyCents: 1900,
    isFree: false,
    shopifyPlanName: "Starter",
    warrantiesPerMonth: 500,
    claimsPerMonth: 100,
    attachmentStorageMb: 10240,
    staffSeats: 2,
    aiCreditsPerMonth: 50,
    warrantyRulesLimit: 10,
    locationsLimit: 1,
    technicianAccounts: 0,
    publicApiEnabled: false,
    customBranding: true,
    pdfCertificate: true,
    qrCodes: true,
    csvExport: true,
    backfillBeyond12Months: true,
    sortOrder: 1,
  },
  {
    name: "Growth",
    slug: "growth",
    priceMonthlyCents: 4900,
    isFree: false,
    shopifyPlanName: "Growth",
    warrantiesPerMonth: 2500,
    claimsPerMonth: 500,
    attachmentStorageMb: 51200,
    staffSeats: 5,
    aiCreditsPerMonth: 300,
    warrantyRulesLimit: 9999,
    locationsLimit: 3,
    technicianAccounts: 5,
    publicApiEnabled: false,
    customBranding: true,
    pdfCertificate: true,
    qrCodes: true,
    csvExport: true,
    backfillBeyond12Months: true,
    repairsEnabled: true,
    customWorkflows: true,
    advancedAnalytics: true,
    flowEnabled: true,
    expiryCampaigns: true,
    bulkOperations: true,
    supplierPortal: true,
    technicianPortal: true,
    sortOrder: 2,
  },
  {
    name: "Pro",
    slug: "pro",
    priceMonthlyCents: 9900,
    isFree: false,
    shopifyPlanName: "Pro",
    warrantiesPerMonth: 10000,
    claimsPerMonth: 99999,
    attachmentStorageMb: 256000,
    staffSeats: 15,
    aiCreditsPerMonth: 1500,
    warrantyRulesLimit: 9999,
    locationsLimit: 10,
    technicianAccounts: 25,
    publicApiEnabled: true,
    customBranding: true,
    pdfCertificate: true,
    qrCodes: true,
    csvExport: true,
    backfillBeyond12Months: true,
    repairsEnabled: true,
    customWorkflows: true,
    advancedAnalytics: true,
    flowEnabled: true,
    expiryCampaigns: true,
    bulkOperations: true,
    supplierPortal: true,
    technicianPortal: true,
    partsInventory: true,
    multiLocation: true,
    erpConnectors: true,
    sortOrder: 3,
  },
] as const;

async function main() {
  for (const plan of PLAN_DEFS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: { ...plan },
      update: { ...plan },
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@aftersale.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: "Platform Admin",
      role: "SUPER_ADMIN",
    },
    update: { passwordHash, active: true },
  });

  await prisma.featureFlag.upsert({
    where: { key: "ai_assistant" },
    create: { key: "ai_assistant", description: "AI claim assistant", enabled: true, percentage: 100 },
    update: {},
  });

  const templates = [
    {
      key: "claim_created",
      subject: "We received your warranty claim",
      bodyHtml: "<p>Your claim {{claimNumber}} was submitted. <a href=\"{{trackingUrl}}\">Track it here</a>.</p>",
    },
    {
      key: "claim_status_approved",
      subject: "Your claim was approved",
      bodyHtml: "<p>Claim {{claimNumber}} is approved. <a href=\"{{trackingUrl}}\">View status</a>.</p>",
    },
    {
      key: "claim_status_rejected",
      subject: "Update on your claim",
      bodyHtml: "<p>Claim {{claimNumber}} was updated. <a href=\"{{trackingUrl}}\">View details</a>.</p>",
    },
    {
      key: "claim_status_waiting_customer",
      subject: "We need more information",
      bodyHtml: "<p>Please reply with more details for claim {{claimNumber}}. <a href=\"{{trackingUrl}}\">Open claim</a>.</p>",
    },
  ] as const;

  for (const t of templates) {
    const existing = await prisma.notificationTemplate.findFirst({
      where: { shopId: null, key: t.key, channel: "email" },
    });
    if (existing) {
      await prisma.notificationTemplate.update({
        where: { id: existing.id },
        data: { subject: t.subject, bodyHtml: t.bodyHtml, active: true },
      });
    } else {
      await prisma.notificationTemplate.create({
        data: {
          shopId: null,
          key: t.key,
          channel: "email",
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          active: true,
        },
      });
    }
  }

  console.log("Seeded plans, admin user, feature flags, and notification templates.");
  console.log(`Admin login: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
