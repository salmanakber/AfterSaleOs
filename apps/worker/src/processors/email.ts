/**
 * Transactional email — Resend when configured; merchant templates from DB when present.
 * Built-in templates use a branded layout with shop name / accent / logo when available.
 */
import { getNotificationTemplateForSend, prisma } from "@aftersale/db";

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    service: "worker",
    processor: "email",
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

type Brand = {
  shopName: string;
  accent: string;
  logoUrl: string | null;
  fromName: string;
};

async function loadBrand(shopId: string): Promise<Brand> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      shopName: true,
      shopDomain: true,
      brandingAccentColor: true,
      brandingLogoUrl: true,
    },
  });
  const shopName = shop?.shopName?.trim() || shop?.shopDomain || "AfterSale";
  return {
    shopName,
    accent: shop?.brandingAccentColor?.trim() || "#111827",
    logoUrl: shop?.brandingLogoUrl ?? null,
    fromName: shopName,
  };
}

export async function processEmailJob(data: {
  shopId: string;
  to: string;
  template: string;
  data: Record<string, unknown>;
}) {
  const started = Date.now();
  const brand = await loadBrand(data.shopId);
  const payload = {
    ...data.data,
    shopName: data.data.shopName ?? brand.shopName,
  };

  const custom = await getNotificationTemplateForSend(data.shopId, data.template);
  let subject: string;
  let html: string;
  const source = custom?.subject && custom.bodyHtml ? "shop_template" : "builtin";

  if (custom?.subject && custom.bodyHtml) {
    subject = interpolate(custom.subject, payload);
    const body = interpolate(custom.bodyHtml, payload);
    // Full HTML docs from Automations stay as-is; fragments get brand chrome
    html = /<!DOCTYPE|<html[\s>]/i.test(body) ? body : wrapEmail(brand, body);
  } else {
    const rendered = renderTemplate(data.template, payload, brand);
    subject = rendered.subject;
    html = rendered.html;
  }

  if (!process.env.RESEND_API_KEY) {
    log("warn", "email.skipped", {
      reason: "missing_resend_api_key",
      shopId: data.shopId,
      to: data.to,
      template: data.template,
      source,
      subject,
      ms: Date.now() - started,
    });
    return;
  }

  if (!process.env.RESEND_FROM_EMAIL) {
    log("warn", "email.skipped", {
      reason: "missing_resend_from_email",
      shopId: data.shopId,
      to: data.to,
      template: data.template,
      source,
      subject,
      ms: Date.now() - started,
    });
    return;
  }

  const fromName = process.env.RESEND_FROM_NAME?.trim() || brand.fromName;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${process.env.RESEND_FROM_EMAIL}>`,
      to: [data.to],
      subject,
      html,
      reply_to: process.env.RESEND_REPLY_TO || undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    log("error", "email.failed", {
      shopId: data.shopId,
      to: data.to,
      template: data.template,
      source,
      status: res.status,
      body: body.slice(0, 500),
      ms: Date.now() - started,
    });
    throw new Error(`Resend failed: ${body}`);
  }

  log("info", "email.sent", {
    shopId: data.shopId,
    to: data.to,
    template: data.template,
    source,
    subject,
    ms: Date.now() - started,
  });
}

function interpolate(template: string, data: Record<string, unknown>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => esc(data[key]));
}

function wrapEmail(brand: Brand, innerHtml: string) {
  const logo = brand.logoUrl
    ? `<img src="${escAttr(brand.logoUrl)}" alt="${escAttr(brand.shopName)}" width="140" style="display:block;max-width:140px;height:auto;margin:0 0 16px;" />`
    : `<div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;margin:0 0 16px;">${esc(brand.shopName)}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(brand.shopName)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="height:4px;background:${escAttr(brand.accent)};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              ${logo}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;font-size:15px;line-height:1.55;color:#334155;">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #f1f5f9;font-size:12px;line-height:1.45;color:#94a3b8;">
              Sent by ${esc(brand.shopName)} via AfterSale · Warranty &amp; care
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(brand: Brand, href: string, label: string) {
  return `<p style="margin:22px 0 8px;">
    <a href="${escAttr(href)}" style="display:inline-block;background:${escAttr(brand.accent)};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px;">
      ${esc(label)}
    </a>
  </p>
  <p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all;">
    Or open: <a href="${escAttr(href)}" style="color:${escAttr(brand.accent)};">${esc(href)}</a>
  </p>`;
}

function renderTemplate(template: string, data: Record<string, unknown>, brand: Brand) {
  const shopName = esc(data.shopName ?? brand.shopName);

  if (template === "guest_magic_link") {
    const body = `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#0f172a;letter-spacing:-0.02em;">Your warranty portal link</h1>
      <p style="margin:0 0 12px;">Use this one-time link to view your warranties. It expires in 15 minutes.</p>
      ${data.orderNumber ? `<p style="margin:0 0 12px;">Order <strong>${esc(data.orderNumber)}</strong></p>` : ""}
      ${ctaButton(brand, String(data.link ?? "#"), "Open warranty portal")}
      <p style="margin:18px 0 0;">If you didn’t request this, you can ignore this email.</p>
    `;
    return {
      subject: `${brand.shopName}: your warranty portal link`,
      html: wrapEmail(brand, body),
    };
  }

  if (template === "claim_created") {
    const body = `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#0f172a;letter-spacing:-0.02em;">We received your claim</h1>
      <p style="margin:0 0 12px;">Thanks for contacting ${shopName}. Your warranty claim <strong>${esc(data.claimNumber)}</strong> is in our queue.</p>
      <p style="margin:0 0 12px;">A team member will review eligibility — nothing is rejected automatically.</p>
      ${ctaButton(brand, String(data.trackingUrl ?? "#"), "Track your claim")}
    `;
    return {
      subject: `${brand.shopName}: claim ${esc(data.claimNumber)} received`,
      html: wrapEmail(brand, body),
    };
  }

  if (template.startsWith("claim_status_")) {
    const body = `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#0f172a;letter-spacing:-0.02em;">Claim update</h1>
      <p style="margin:0 0 12px;">Your claim <strong>${esc(data.claimNumber)}</strong> is now <strong>${esc(data.status)}</strong>.</p>
      ${data.summary ? `<p style="margin:0 0 12px;">${esc(data.summary)}</p>` : ""}
      ${ctaButton(brand, String(data.trackingUrl ?? "#"), "View claim status")}
      <p style="margin:18px 0 0;">— ${shopName}</p>
    `;
    return {
      subject: `${brand.shopName}: claim ${esc(data.claimNumber)} → ${esc(data.status)}`,
      html: wrapEmail(brand, body),
    };
  }

  if (template.startsWith("repair_status_")) {
    const body = `
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#0f172a;letter-spacing:-0.02em;">Repair update</h1>
      <p style="margin:0 0 12px;">Repair <strong>${esc(data.repairNumber)}</strong> for claim <strong>${esc(data.claimNumber)}</strong> is now <strong>${esc(data.status)}</strong>.</p>
      ${ctaButton(brand, String(data.trackingUrl ?? "#"), "View details")}
      <p style="margin:18px 0 0;">— ${shopName}</p>
    `;
    return {
      subject: `${brand.shopName}: repair ${esc(data.repairNumber)} → ${esc(data.status)}`,
      html: wrapEmail(brand, body),
    };
  }

  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#0f172a;">Update from ${shopName}</h1>
    <p style="margin:0 0 12px;">You have a new message related to your warranty or claim.</p>
    <pre style="margin:0;padding:12px;background:#f8fafc;border-radius:8px;font-size:12px;overflow:auto;">${esc(JSON.stringify(data, null, 2))}</pre>
  `;
  return {
    subject: `${brand.shopName}: ${template}`,
    html: wrapEmail(brand, body),
  };
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(value: unknown) {
  return esc(value).replace(/'/g, "&#39;");
}
