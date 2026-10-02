import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@aftersale/db";

export const runtime = "nodejs";

/** Downloadable warranty certificate PDF (plan-gated via shop plan flag). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const warranty = await prisma.warranty.findUnique({
    where: { certificateToken: token },
    include: {
      shop: { include: { plan: true } },
      customer: true,
      ruleVersion: { include: { rule: true } },
      warrantyUnit: { include: { orderLineItem: { include: { order: true } } } },
    },
  });

  if (!warranty || warranty.status === "VOID") {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  if (warranty.shop.plan && !warranty.shop.plan.pdfCertificate) {
    return NextResponse.json(
      { error: "PDF certificates are not enabled on this store's plan." },
      { status: 403 },
    );
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const title = warranty.shop.shopName ?? "Warranty certificate";
  page.drawText(title, { x: 48, y: 720, size: 20, font: bold, color: rgb(0.1, 0.1, 0.15) });
  page.drawText("AfterSale OS — Warranty certificate", { x: 48, y: 698, size: 11, font, color: rgb(0.4, 0.45, 0.5) });

  const lines = [
    `Product: ${warranty.warrantyUnit.orderLineItem.title}`,
    `Order: ${warranty.warrantyUnit.orderLineItem.order.orderNumber}`,
    `Status: ${warranty.status}`,
    `Coverage: ${warranty.ruleVersion.rule.name} (${warranty.ruleVersion.warrantyType})`,
    `Start: ${warranty.startAt?.toISOString().slice(0, 10) ?? "Pending"}`,
    `End: ${warranty.endAt?.toISOString().slice(0, 10) ?? "Lifetime"}`,
    warranty.warrantyUnit.serialNumber ? `Serial: ${warranty.warrantyUnit.serialNumber}` : "",
    warranty.customer?.email ? `Customer: ${warranty.customer.email}` : "",
  ].filter(Boolean);

  let y = 640;
  for (const line of lines) {
    page.drawText(line, { x: 48, y, size: 12, font });
    y -= 22;
  }

  page.drawText("Terms", { x: 48, y: y - 12, size: 12, font: bold });
  const terms = (warranty.ruleVersion.termsHtml ?? "Standard warranty terms apply.")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
  page.drawText(terms, { x: 48, y: y - 36, size: 10, font, maxWidth: 516, lineHeight: 14 });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="warranty-${token.slice(0, 8)}.pdf"`,
    },
  });
}
