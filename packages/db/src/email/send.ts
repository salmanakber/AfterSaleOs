/**
 * Shared transactional email sender (web API + worker).
 * Uses Resend when configured; never throws away silently without a clear log reason.
 */
import { prisma } from "../client";
import { getNotificationTemplateForSend } from "../merchant-ops";
import { getResendConfig } from "../platform";

export type SendEmailInput = {
  shopId: string;
  to: string;
  template: string;
  data: Record<string, unknown>;
};

type Brand = {
  shopName: string;
  accent: string;
  logoUrl: string | null;
};

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

function interpolate(template: string, data: Record<string, unknown>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => esc(data[key]));
}

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
  return {
    shopName: shop?.shopName?.trim() || shop?.shopDomain || "AfterSale",
    accent: shop?.brandingAccentColor?.trim() || "#111827",
    logoUrl: shop?.brandingLogoUrl ?? null,
  };
}

function wrapEmail(brand: Brand, innerHtml: string) {
  const logo = brand.logoUrl
    ? `<img src="${escAttr(brand.logoUrl)}" alt="${escAttr(brand.shopName)}" width="132" style="display:block;max-width:132px;height:auto;border-radius:10px;" />`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#0c1210;line-height:1.2;">${esc(brand.shopName)}</div>`;

  // Matches client portal look: soft paper canvas, brand accent bar, rounded card, serif headlines.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${esc(brand.shopName)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0c1210;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 14px;background:#f3f5f4;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;border:1px solid #e4e9e6;overflow:hidden;box-shadow:0 18px 40px rgba(12,18,16,0.06);">
          <tr>
            <td style="height:5px;background:${escAttr(brand.accent)};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">${logo}</td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${escAttr(brand.accent)};background:#f7f9f8;padding:6px 10px;border-radius:999px;border:1px solid #e4e9e6;">Warranty &amp; care</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 28px;font-size:15px;line-height:1.6;color:#3d4a44;">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid #eef2f0;font-size:12px;line-height:1.5;color:#8a9690;">
              Sent by <strong style="color:#0c1210;">${esc(brand.shopName)}</strong>
              <span style="color:#c5cec9;"> · </span>
              Powered by AfterSale
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#9aa5a0;max-width:560px;">
          You’re receiving this because of a warranty or claim related to your purchase.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function cta(brand: Brand, href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 10px;"><tr><td style="border-radius:12px;background:${escAttr(brand.accent)};">
  <a href="${escAttr(href)}" style="display:inline-block;padding:13px 20px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:-0.01em;">${esc(label)}</a>
</td></tr></table>
<p style="margin:0;font-size:12px;line-height:1.5;color:#8a9690;word-break:break-all;">Or open: <a href="${escAttr(href)}" style="color:${escAttr(brand.accent)};font-weight:600;text-decoration:underline;">${esc(href)}</a></p>`;
}

function heading(text: string) {
  return `<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;letter-spacing:-0.02em;font-weight:700;color:#0c1210;">${esc(text)}</h1>`;
}

function noteBox(brand: Brand, text: string) {
  return `<p style="margin:14px 0;padding:14px 16px;background:#f7f9f8;border-radius:12px;border:1px solid #e4e9e6;border-left:3px solid ${escAttr(brand.accent)};color:#3d4a44;">${esc(text)}</p>`;
}

function builtinTemplate(template: string, data: Record<string, unknown>, brand: Brand) {
  const shopName = esc(data.shopName ?? brand.shopName);
  if (template === "guest_magic_link") {
    return {
      subject: `${brand.shopName}: your warranty portal link`,
      html: wrapEmail(
        brand,
        `${heading("Your warranty portal link")}
        <p style="margin:0 0 10px;">Use this one-time link to open your client portal. It expires in 15 minutes.</p>
        ${data.orderNumber ? `<p style="margin:0 0 10px;">Order <strong>${esc(data.orderNumber)}</strong></p>` : ""}
        ${cta(brand, String(data.link ?? "#"), "Open warranty portal")}`,
      ),
    };
  }
  if (template === "claim_created") {
    return {
      subject: `${brand.shopName}: we received claim ${esc(data.claimNumber)}`,
      html: wrapEmail(
        brand,
        `${heading("We received your claim")}
        <p style="margin:0 0 10px;">Thanks for contacting ${shopName}. Claim <strong>${esc(data.claimNumber)}</strong> is in our queue${data.productTitle ? ` for <strong>${esc(data.productTitle)}</strong>` : ""}.</p>
        ${data.summary ? noteBox(brand, String(data.summary)) : ""}
        ${cta(brand, String(data.trackingUrl ?? "#"), "Track your claim")}`,
      ),
    };
  }
  if (template === "claim_customer_note") {
    return {
      subject: `${brand.shopName}: update on claim ${esc(data.claimNumber)}`,
      html: wrapEmail(
        brand,
        `${heading(`Message from ${brand.shopName}`)}
        <p style="margin:0 0 10px;">There’s a new update on claim <strong>${esc(data.claimNumber)}</strong>.</p>
        ${data.note ? noteBox(brand, String(data.note)) : ""}
        ${cta(brand, String(data.trackingUrl ?? "#"), "View claim status")}`,
      ),
    };
  }
  if (template.startsWith("claim_resolution_")) {
    const kind = String(data.resolutionKind || template.replace("claim_resolution_", ""));
    const title =
      kind === "refund"
        ? "Refund in progress"
        : kind === "replacement"
          ? "Replacement in progress"
          : kind === "repair"
            ? "Repair started"
            : "We’re resolving your claim";
    return {
      subject: `${brand.shopName}: ${title.toLowerCase()} · ${esc(data.claimNumber)}`,
      html: wrapEmail(
        brand,
        `${heading(title)}
        <p style="margin:0 0 10px;">Claim <strong>${esc(data.claimNumber)}</strong> is now <strong>${esc(data.statusLabel ?? data.status)}</strong>.</p>
        ${data.note ? noteBox(brand, String(data.note)) : ""}
        ${cta(brand, String(data.trackingUrl ?? "#"), "Track your claim")}`,
      ),
    };
  }
  if (template.startsWith("claim_status_")) {
    const label = esc(data.statusLabel ?? data.status);
    return {
      subject: `${brand.shopName}: claim ${esc(data.claimNumber)} is ${label}`,
      html: wrapEmail(
        brand,
        `${heading("Claim update")}
        <p style="margin:0 0 10px;">Claim <strong>${esc(data.claimNumber)}</strong> is now <strong>${label}</strong>.</p>
        ${data.productTitle ? `<p style="margin:0 0 10px;color:#6b7a73;">Product: ${esc(data.productTitle)}</p>` : ""}
        ${data.note ? noteBox(brand, String(data.note)) : ""}
        ${!data.note && data.summary ? `<p style="margin:0 0 10px;">${esc(data.summary)}</p>` : ""}
        ${cta(brand, String(data.trackingUrl ?? "#"), "View claim status")}`,
      ),
    };
  }
  if (template.startsWith("repair_status_")) {
    return {
      subject: `${brand.shopName}: repair ${esc(data.repairNumber)} → ${esc(data.status)}`,
      html: wrapEmail(
        brand,
        `${heading("Repair update")}
        <p style="margin:0 0 10px;">Repair <strong>${esc(data.repairNumber)}</strong> is now <strong>${esc(data.status)}</strong>.</p>
        ${cta(brand, String(data.trackingUrl ?? "#"), "View details")}`,
      ),
    };
  }
  if (template === "warranty_expiring") {
    return {
      subject: `${brand.shopName}: your warranty expires soon`,
      html: wrapEmail(
        brand,
        `${heading("Coverage ending soon")}
        <p style="margin:0 0 10px;">Your warranty for <strong>${esc(data.productTitle)}</strong> (order <strong>${esc(data.orderNumber)}</strong>) ends on <strong>${esc(data.endAt)}</strong>.</p>
        <p style="margin:0 0 10px;">Open your portal to view the certificate or start a claim while you’re still covered.</p>
        ${cta(brand, String(data.link ?? "#"), "Open warranty portal")}
        ${data.claimLink ? `<p style="margin:14px 0 0;"><a href="${escAttr(data.claimLink)}" style="color:${escAttr(brand.accent)};font-weight:700;text-decoration:underline;">Start a claim</a></p>` : ""}`,
      ),
    };
  }
  if (template === "warranty_registered") {
    return {
      subject: `${brand.shopName}: warranty registered`,
      html: wrapEmail(
        brand,
        `${heading("You’re covered")}
        <p style="margin:0 0 10px;">Thanks for registering <strong>${esc(data.productTitle)}</strong> with ${shopName}.</p>
        ${cta(brand, String(data.link ?? "#"), "View your warranty")}`,
      ),
    };
  }
  if (template === "marketing_broadcast") {
    const customBody = String(data.bodyHtml ?? "");
    return {
      subject: String(data.subject ?? `${brand.shopName}: an update from us`),
      html: wrapEmail(
        brand,
        `${customBody || "<p style=\"margin:0 0 10px;\">We have an update about your warranty coverage.</p>"}
        ${cta(brand, String(data.link ?? "#"), "Open warranty portal")}`,
      ),
    };
  }
  return {
    subject: `${brand.shopName}: ${template}`,
    html: wrapEmail(brand, `<pre style="white-space:pre-wrap;font-size:12px;">${esc(JSON.stringify(data, null, 2))}</pre>`),
  };
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<{
  sent: boolean;
  reason?: string;
  subject?: string;
}> {
  const brand = await loadBrand(input.shopId);
  const payload = { ...input.data, shopName: input.data.shopName ?? brand.shopName };
  const custom = await getNotificationTemplateForSend(input.shopId, input.template);

  let subject: string;
  let html: string;
  if (custom?.subject && custom.bodyHtml) {
    subject = interpolate(custom.subject, payload);
    const body = interpolate(custom.bodyHtml, payload);
    html = /<!DOCTYPE|<html[\s>]/i.test(body) ? body : wrapEmail(brand, body);
  } else {
    const built = builtinTemplate(input.template, payload, brand);
    subject = built.subject;
    html = built.html;
  }

  const resend = await getResendConfig();
  if (!resend.apiKey) {
    console.warn(
      JSON.stringify({
        event: "email.skipped",
        reason: "missing_resend_api_key",
        template: input.template,
        to: input.to,
        shopId: input.shopId,
      }),
    );
    return { sent: false, reason: "missing_resend_api_key", subject };
  }
  if (!resend.fromEmail) {
    console.warn(
      JSON.stringify({
        event: "email.skipped",
        reason: "missing_resend_from_email",
        template: input.template,
        to: input.to,
        shopId: input.shopId,
      }),
    );
    return { sent: false, reason: "missing_resend_from_email", subject };
  }

  const fromName = resend.fromName || brand.shopName;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${resend.fromEmail}>`,
      to: [input.to],
      subject,
      html,
      reply_to: resend.replyTo || undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(
      JSON.stringify({
        event: "email.failed",
        status: res.status,
        body: body.slice(0, 400),
        template: input.template,
        to: input.to,
        shopId: input.shopId,
      }),
    );
    throw new Error(`Resend failed: ${body.slice(0, 300)}`);
  }

  console.log(
    JSON.stringify({
      event: "email.sent",
      template: input.template,
      to: input.to,
      shopId: input.shopId,
      subject,
    }),
  );
  return { sent: true, subject };
}
