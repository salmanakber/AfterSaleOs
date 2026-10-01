import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@aftersale/db";

function secret() {
  const raw = process.env.ADMIN_JWT_SECRET ?? "dev-admin-secret-change-me";
  return new TextEncoder().encode(raw);
}

export async function loginAdmin(email: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !user.active) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());

  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

export async function verifyAdminToken(token: string) {
  const { payload } = await jwtVerify(token, secret());
  return payload as { sub: string; email: string; role: string };
}
