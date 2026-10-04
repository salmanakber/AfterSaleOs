import { NextRequest, NextResponse } from "next/server";
import {
  getAiPlatformConfigPublic,
  updateAiPlatformConfig,
  type AiProviderId,
  type AiTaskId,
} from "@aftersale/db";
import { verifyAdminToken } from "@/lib/auth";

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new Error("Unauthorized");
  await verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const config = await getAiPlatformConfigPublic();
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as {
      providers?: Array<{
        id: AiProviderId;
        apiKey?: string | null;
        clearKey?: boolean;
        model?: string;
        enabled?: boolean;
      }>;
      taskRoutes?: Partial<Record<AiTaskId, AiProviderId[]>>;
    };
    const config = await updateAiPlatformConfig({
      providers: body.providers,
      taskRoutes: body.taskRoutes,
    });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    if (msg === "Unauthorized" || msg.toLowerCase().includes("unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
