import bcrypt from "bcryptjs";
import { prisma } from "./client";
import { getPortalOrdersForEmail, getPortalWarranties } from "./warranty/registration";

const MIN_PASSWORD = 8;

export type PortalAuthSession = {
  email: string;
  name: string | null;
  phone: string | null;
  orders: Awaited<ReturnType<typeof getPortalOrdersForEmail>>;
  warranties: Array<{
    id: string;
    status: string;
    productTitle: string;
    orderNumber: string;
    serialNumber: string | null;
    certificateToken: string;
    startAt: string | null;
    endAt: string | null;
    ruleName: string;
  }>;
  source: "password" | "register";
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function loadPortalAuthSession(
  shopId: string,
  email: string,
  source: PortalAuthSession["source"],
  extras?: { name?: string | null; phone?: string | null },
): Promise<PortalAuthSession> {
  const [orders, warranties] = await Promise.all([
    getPortalOrdersForEmail({ shopId, email }),
    getPortalWarranties({ shopId, email }),
  ]);
  return {
    email,
    name: extras?.name ?? null,
    phone: extras?.phone ?? null,
    orders,
    warranties: warranties.map((w) => ({
      id: w.id,
      status: w.status,
      productTitle: w.warrantyUnit.orderLineItem.title,
      orderNumber: w.warrantyUnit.orderLineItem.order.orderNumber,
      serialNumber: w.warrantyUnit.serialNumber,
      certificateToken: w.certificateToken,
      startAt: w.startAt?.toISOString() ?? null,
      endAt: w.endAt?.toISOString() ?? null,
      ruleName: w.ruleVersion.rule.name,
    })),
    source,
  };
}

export async function registerPortalAccount(params: {
  shopId: string;
  email: string;
  password: string;
  name?: string;
  phone?: string;
  phoneCountry?: string;
}): Promise<PortalAuthSession> {
  const email = normalizeEmail(params.email);
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  if (!params.password || params.password.length < MIN_PASSWORD) {
    throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
  }

  const existing = await prisma.customerPortalAccount.findUnique({
    where: { shopId_email: { shopId: params.shopId, email } },
  });
  if (existing) {
    throw new Error("An account already exists for this email. Sign in instead.");
  }

  const passwordHash = await bcrypt.hash(params.password, 12);
  const name = params.name?.trim() || null;
  const phone = params.phone?.trim() || null;
  const phoneCountry = params.phoneCountry?.trim().toUpperCase() || null;
  await prisma.customerPortalAccount.create({
    data: {
      shopId: params.shopId,
      email,
      passwordHash,
      name,
      phone,
      phoneCountry,
      lastLoginAt: new Date(),
    },
  });

  if (phone) {
    await prisma.customer.updateMany({
      where: { shopId: params.shopId, email },
      data: { phone },
    });
  }

  return loadPortalAuthSession(params.shopId, email, "register", { name, phone });
}

export async function loginPortalAccount(params: {
  shopId: string;
  email: string;
  password: string;
}): Promise<PortalAuthSession> {
  const email = normalizeEmail(params.email);
  if (!email || !params.password) {
    throw new Error("Email and password are required.");
  }

  const account = await prisma.customerPortalAccount.findUnique({
    where: { shopId_email: { shopId: params.shopId, email } },
  });
  if (!account) {
    throw new Error("No account found for this email. Create one to get started.");
  }

  const ok = await bcrypt.compare(params.password, account.passwordHash);
  if (!ok) {
    throw new Error("Incorrect email or password.");
  }

  await prisma.customerPortalAccount.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
  });

  return loadPortalAuthSession(params.shopId, email, "password", {
    name: account.name,
    phone: account.phone,
  });
}

/** Create account if missing, or verify password if it exists (used after product register). */
export async function upsertPortalAccountAfterRegister(params: {
  shopId: string;
  email: string;
  password: string;
  name?: string;
  phone?: string;
  phoneCountry?: string;
}): Promise<PortalAuthSession> {
  const email = normalizeEmail(params.email);
  const existing = await prisma.customerPortalAccount.findUnique({
    where: { shopId_email: { shopId: params.shopId, email } },
  });
  if (!existing) {
    return registerPortalAccount(params);
  }
  const ok = await bcrypt.compare(params.password, existing.passwordHash);
  if (!ok) {
    throw new Error("That email already has an account — use the correct password to continue.");
  }
  await prisma.customerPortalAccount.update({
    where: { id: existing.id },
    data: {
      lastLoginAt: new Date(),
      ...(params.phone ? { phone: params.phone.trim() } : {}),
      ...(params.phoneCountry ? { phoneCountry: params.phoneCountry.trim().toUpperCase() } : {}),
      ...(params.name?.trim() ? { name: params.name.trim() } : {}),
    },
  });
  return loadPortalAuthSession(params.shopId, email, "password", {
    name: params.name?.trim() || existing.name,
    phone: params.phone?.trim() || existing.phone,
  });
}
