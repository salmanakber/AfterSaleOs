import { NextRequest, NextResponse } from "next/server";
import { prisma, readAttachmentFile, verifyDownloadToken } from "@aftersale/db";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const parsed = verifyDownloadToken(token);
  if (!parsed) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

  const attachment = await prisma.attachment.findFirst({
    where: { id: parsed.attachmentId, shopId: parsed.shopId },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (attachment.scanStatus === "quarantine") {
    return NextResponse.json({ error: "File unavailable" }, { status: 403 });
  }

  const bytes = await readAttachmentFile(attachment.storageKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Disposition": `inline; filename="${attachment.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
