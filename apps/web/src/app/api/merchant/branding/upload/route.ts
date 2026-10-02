import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aftersale/db";
import { resolveMerchantContext } from "@/lib/auth/merchant";
import { isCloudinaryConfigured, uploadLogoToCloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const merchant = await resolveMerchantContext(request);

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        {
          error:
            "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your environment.",
        },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type) && file.type !== "") {
      return NextResponse.json({ error: "Use PNG, JPG, WEBP, GIF, or SVG" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Logo must be under 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadLogoToCloudinary({
      buffer,
      mimeType: file.type || "image/png",
      fileName: file.name || "logo.png",
      shopDomain: merchant.shopDomain,
    });

    await prisma.shop.update({
      where: { id: merchant.shopId },
      data: { brandingLogoUrl: uploaded.url },
    });

    return NextResponse.json({
      ok: true,
      url: uploaded.url,
      publicId: uploaded.publicId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
