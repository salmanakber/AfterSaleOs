import { NextRequest, NextResponse } from "next/server";
import { saveClaimAttachment, shopRepository } from "@aftersale/db";
import { normalizeShopDomain } from "@aftersale/shared";
import { verifyAppProxySignature, shopDomainFromProxy } from "@/lib/app-proxy";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const secret = process.env.SHOPIFY_API_SECRET ?? "";
  if (sp.get("signature") && !verifyAppProxySignature(sp, secret)) {
    return NextResponse.json({ error: "Invalid proxy signature" }, { status: 401 });
  }

  const shopParam =
    shopDomainFromProxy(sp) ?? request.headers.get("x-aftersale-shop") ?? sp.get("shop");
  if (!shopParam) return NextResponse.json({ error: "Missing shop" }, { status: 400 });

  const shop = await shopRepository.findByDomain(normalizeShopDomain(shopParam));
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await rateLimit({
    key: `upload:${shop.id}:${ip}`,
    limit: 20,
    windowSeconds: 600,
  });
  if (!allowed) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const attachment = await saveClaimAttachment({
      shopId: shop.id,
      fileName: file.name || "upload",
      contentType: file.type || "application/octet-stream",
      bytes,
    });
    return NextResponse.json({
      id: attachment.id,
      fileName: attachment.fileName,
      scanStatus: attachment.scanStatus,
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : null;
    if (code === "FILE_TYPE" || code === "FILE_TOO_LARGE") {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid file" },
        { status: 400 },
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
