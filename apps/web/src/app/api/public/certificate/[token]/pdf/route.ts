import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { prisma } from "@aftersale/db";

export const runtime = "nodejs";

function parseHexColor(hex: string | null | undefined) {
  const raw = (hex ?? "#1f2937").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return rgb(0.12, 0.16, 0.22);
  const n = parseInt(raw, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawLabelValue(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  x: number,
  y: number,
  label: string,
  value: string,
) {
  page.drawText(label, { x, y, size: 9, font, color: rgb(0.45, 0.48, 0.52) });
  page.drawText(value, { x, y: y - 16, size: 12, font: bold, color: rgb(0.12, 0.14, 0.18) });
}

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

  const shop = warranty.shop;
  const accent = parseHexColor(shop.brandingAccentColor);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Header band
  page.drawRectangle({ x: 0, y: 732, width: 612, height: 60, color: accent });
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 36, color: rgb(0.96, 0.97, 0.98) });

  let logoBottom = 700;
  if (shop.brandingLogoUrl) {
    try {
      const logoRes = await fetch(shop.brandingLogoUrl, { signal: AbortSignal.timeout(5000) });
      if (logoRes.ok) {
        const bytes = new Uint8Array(await logoRes.arrayBuffer());
        const contentType = logoRes.headers.get("content-type") ?? "";
        const isJpg = contentType.includes("jpeg") || contentType.includes("jpg") || shop.brandingLogoUrl.match(/\.jpe?g(\?|$)/i);
        const image = isJpg ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
        const maxH = 40;
        const maxW = 140;
        const scale = Math.min(maxW / image.width, maxH / image.height);
        const w = image.width * scale;
        const h = image.height * scale;
        page.drawImage(image, { x: 40, y: 742, width: w, height: h });
        logoBottom = 742;
      }
    } catch {
      // Logo fetch optional — fall back to text brand
    }
  }

  const brand = shop.shopName ?? shop.shopDomain ?? "Warranty certificate";
  if (!shop.brandingLogoUrl || logoBottom === 700) {
    page.drawText(brand.slice(0, 40), {
      x: 40,
      y: 754,
      size: 16,
      font: bold,
      color: rgb(1, 1, 1),
    });
  } else {
    page.drawText("Warranty certificate", {
      x: 200,
      y: 754,
      size: 14,
      font: bold,
      color: rgb(1, 1, 1),
    });
  }

  page.drawText("Official coverage document", {
    x: 40,
    y: 690,
    size: 10,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });
  page.drawText(brand, { x: 40, y: 668, size: 22, font: bold, color: rgb(0.1, 0.12, 0.16) });

  // Accent rule
  page.drawRectangle({ x: 40, y: 652, width: 80, height: 3, color: accent });

  const product = warranty.warrantyUnit.orderLineItem.title;
  const orderNo = warranty.warrantyUnit.orderLineItem.order.orderNumber;
  const coverage = `${warranty.ruleVersion.rule.name} · ${warranty.ruleVersion.warrantyType}`;
  const start = warranty.startAt?.toISOString().slice(0, 10) ?? "Pending";
  const end = warranty.endAt?.toISOString().slice(0, 10) ?? "Lifetime";
  const serial = warranty.warrantyUnit.serialNumber;
  const customer = warranty.customer?.email;

  // Detail cards (two columns)
  page.drawRectangle({
    x: 40,
    y: 500,
    width: 250,
    height: 130,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.88, 0.9, 0.92),
    borderWidth: 1,
  });
  page.drawRectangle({
    x: 322,
    y: 500,
    width: 250,
    height: 130,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.88, 0.9, 0.92),
    borderWidth: 1,
  });

  drawLabelValue(page, font, bold, 56, 600, "PRODUCT", product.slice(0, 36));
  drawLabelValue(page, font, bold, 56, 555, "ORDER", String(orderNo));
  drawLabelValue(page, font, bold, 338, 600, "STATUS", warranty.status);
  drawLabelValue(page, font, bold, 338, 555, "COVERAGE", coverage.slice(0, 32));

  drawLabelValue(page, font, bold, 40, 460, "START DATE", start);
  drawLabelValue(page, font, bold, 220, 460, "END DATE", end);
  if (serial) drawLabelValue(page, font, bold, 400, 460, "SERIAL", serial.slice(0, 22));
  if (customer) {
    page.drawText("CUSTOMER", { x: 40, y: 400, size: 9, font, color: rgb(0.45, 0.48, 0.52) });
    page.drawText(customer.slice(0, 50), {
      x: 40,
      y: 384,
      size: 12,
      font: bold,
      color: rgb(0.12, 0.14, 0.18),
    });
  }

  page.drawText("Terms", { x: 40, y: 340, size: 12, font: bold, color: rgb(0.12, 0.14, 0.18) });
  const terms = (warranty.ruleVersion.termsHtml ?? "Standard warranty terms apply.")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
  const termLines = wrapText(terms, font, 10, 532);
  let y = 318;
  for (const line of termLines.slice(0, 12)) {
    page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.25, 0.28, 0.32) });
    y -= 14;
  }

  page.drawText(`Certificate ID: ${token.slice(0, 12)}…`, {
    x: 40,
    y: 14,
    size: 8,
    font,
    color: rgb(0.5, 0.55, 0.6),
  });
  page.drawText("Powered by AfterSale OS", {
    x: 430,
    y: 14,
    size: 8,
    font,
    color: rgb(0.5, 0.55, 0.6),
  });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="warranty-${token.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
