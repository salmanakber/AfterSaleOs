import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aftersale/db";
import {
  staffWorkspaceAdminUrl,
  verifyStaffInviteToken,
} from "@/lib/staff-invite";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") || "";
  const payload = verifyStaffInviteToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "This invite link is invalid or expired." }, { status: 400 });
  }

  const staff = await prisma.staffMember.findFirst({
    where: { id: payload.staffId, shopId: payload.shopId },
    include: { shop: true },
  });

  if (!staff || !staff.active) {
    return NextResponse.json(
      { ok: false, error: "This team member is inactive or was removed." },
      { status: 404 },
    );
  }

  if (staff.email.toLowerCase() !== payload.email.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Invite no longer matches this member." }, { status: 400 });
  }

  if (staff.shop.status === "UNINSTALLED") {
    return NextResponse.json({ ok: false, error: "This store is no longer connected." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    shopName: staff.shop.shopName || staff.shop.shopDomain.replace(".myshopify.com", ""),
    shopDomain: staff.shop.shopDomain,
    memberName: staff.name,
    memberEmail: staff.email,
    role: staff.role,
    workspaceUrl: staffWorkspaceAdminUrl(staff.shop.shopDomain),
  });
}
