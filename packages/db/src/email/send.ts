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
    ? `<img src="${escAttr(brand.logoUrl)}" alt="${escAttr(brand.shopName)}" width="140" style="display:block;max-width:140px;height:auto;margin:0 0 16px;" />`
    : `<div style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 16px;">${esc(brand.shopName)}</div>`;

  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;background:#f4f6f8;"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;">
  <tr><td style="height:4px;background:${escAttr(brand.accent)};font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:28px 28px 8px;">${logo}</td></tr>
  <tr><td style="padding:0 28px 28px;font-size:15px;line-height:1.55;color:#334155;">${innerHtml}</td></tr>
  <tr><td style="padding:16px 28px 24px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;">Sent by ${esc(brand.shopName)} via AfterSale</td></tr>
  </table></td></tr></table></body></html>`;
}

function cta(brand: Brand, href: string, label: string) {
  return `<p style="margin:22px 0 8px;"><a href="${escAttr(href)}" style="display:inline-block;background:${escAttr(brand.accent)};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px;">${esc(label)}</a></p>
  <p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all;">Or open: <a href="${escAttr(href)}" style="color:${escAttr(brand.accent)};">${esc(href)}</a></p>`;
}

function builtinTemplate(template: string, data: Record<string, unknown>, brand: Brand) {
  const shopName = esc(data.shopName ?? brand.shopName);
  if (template === "guest_magic_link") {
    return {
      subject: `${brand.shopName}: your warranty portal link`,
      html: wrapEmail(
        brand,
        `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Your warranty portal link</h1>
        <p>Use this one-time link to view your warranties. It expires in 15 minutes.</p>
        ${data.orderNumber ? `<p>Order <strong>${esc(data.orderNumber)}</strong></p>` : ""}
        ${cta(brand, String(data.link ?? "#"), "Open warranty portal")}`,
      ),
    };
  }
  if (template === "claim_created") {
    return {
      subject: `${brand.shopName}: claim ${esc(data.claimNumber)} received`,
      html: wrapEmail(
        brand,
        `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">We received your claim</h1>
        <p>Thanks for contacting ${shopName}. Claim <strong>${esc(data.claimNumber)}</strong> is in our queue.</p>
        ${cta(brand, String(data.trackingUrl ?? "#"), "Track your claim")}`,
      ),
    };
  }
  if (template.startsWith("claim_status_")) {
    return {
      subject: `${brand.shopName}: claim ${esc(data.claimNumber)} → ${esc(data.status)}`,
      html: wrapEmail(
        brand,
        `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Claim update</h1>
        <p>Claim <strong>${esc(data.claimNumber)}</strong> is now <strong>${esc(data.status)}</strong>.</p>
        ${data.summary ? `<p>${esc(data.summary)}</p>` : ""}
        ${cta(brand, String(data.trackingUrl ?? "#"), "View claim status")}`,
      ),
    };
  }
  if (template.startsWith("repair_status_")) {
    return {
      subject: `${brand.shopName}: repair ${esc(data.repairNumber)} → ${esc(data.status)}`,
      html: wrapEmail(
        brand,
        `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Repair update</h1>
        <p>Repair <strong>${esc(data.repairNumber)}</strong> is now <strong>${esc(data.status)}</strong>.</p>
        ${cta(brand, String(data.trackingUrl ?? "#"), "View details")}`,
      ),
    };
  }
  if (template === "warranty_expiring") {
    return {
      subject: `${brand.shopName}: your warranty expires soon`,
      html: wrapEmail(
        brand,
        `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Coverage ending soon</h1>
        <p>Your warranty for <strong>${esc(data.productTitle)}</strong> (order <strong>${esc(data.orderNumber)}</strong>) ends on <strong>${esc(data.endAt)}</strong>.</p>
        <p>Open your portal to view the certificate or start a claim while you’re still covered.</p>
        ${cta(brand, String(data.link ?? "#"), "Open warranty portal")}
        ${data.claimLink ? `<p style="margin-top:12px;"><a href="${escAttr(data.claimLink)}" style="color:${escAttr(brand.accent)};font-weight:600;">Start a claim</a></p>` : ""}`,
      ),
    };
  }
  if (template === "warranty_registered") {
    return {
      subject: `${brand.shopName}: warranty registered`,
      html: wrapEmail(
        brand,
        `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">You’re covered</h1>
        <p>Thanks for registering <strong>${esc(data.productTitle)}</strong> with ${shopName}.</p>
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
        `${customBody || "<p>We have an update about your warranty coverage.</p>"}
        ${cta(brand, String(data.link ?? "#"), "Open warranty portal")}`,
      ),
    };
  }
  return {
    subject: `${brand.shopName}: ${template}`,
    html: wrapEmail(brand, `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`),
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
