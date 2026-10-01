import { NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/auth";
import { audit } from "@/lib/admin-db";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  const result = await loginAdmin(body.email, body.password);
  if (!result) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  await audit({
    adminUserId: result.user.id,
    action: "admin.login",
    meta: { email: result.user.email },
  });

  return NextResponse.json(result);
}
