/**
 * Transactional email — Resend when configured; merchant templates from DB when present.
 */
import { getNotificationTemplateForSend } from "@aftersale/db";

export async function processEmailJob(data: {
  shopId: string;
  to: string;
  template: string;
  data: Record<string, unknown>;
}) {
  const custom = await getNotificationTemplateForSend(data.shopId, data.template);
  let subject: string;
  let html: string;

  if (custom?.subject && custom.bodyHtml) {
    subject = interpolate(custom.subject, data.data);
    html = interpolate(custom.bodyHtml, data.data);
  } else {
    const rendered = renderTemplate(data.template, data.data);
    subject = rendered.subject;
    html = rendered.html;
  }

  if (!process.env.RESEND_API_KEY) {
    console.log("[email] skipped (no RESEND_API_KEY)", {
      to: data.to,
      template: data.template,
      shopId: data.shopId,
      subject,
    });
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${process.env.RESEND_FROM_NAME ?? "AfterSale OS"} <${process.env.RESEND_FROM_EMAIL}>`,
      to: [data.to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend failed: ${await res.text()}`);
  }
}

function interpolate(template: string, data: Record<string, unknown>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => esc(data[key]));
}

function renderTemplate(template: string, data: Record<string, unknown>) {
  if (template === "guest_magic_link") {
    return {
      subject: "Your warranty portal link",
      html: `<p>Use this one-time link to view your warranties (expires in 15 minutes):</p>
        <p><a href="${esc(data.link)}">Open warranty portal</a></p>
        <p>Order: ${esc(data.orderNumber)}</p>`,
    };
  }

  if (template === "claim_created") {
    return {
      subject: `Claim ${esc(data.claimNumber)} received`,
      html: `<p>We received your warranty claim <strong>${esc(data.claimNumber)}</strong>.</p>
        <p><a href="${esc(data.trackingUrl)}">Track your claim</a></p>
        <p>Eligibility is reviewed by the merchant and is never an automatic rejection.</p>`,
    };
  }

  if (template.startsWith("claim_status_")) {
    return {
      subject: `Claim ${esc(data.claimNumber)} update: ${esc(data.status)}`,
      html: `<p>Your claim <strong>${esc(data.claimNumber)}</strong> is now <strong>${esc(data.status)}</strong>.</p>
        <p>${esc(data.summary)}</p>
        <p><a href="${esc(data.trackingUrl)}">View claim status</a></p>
        <p>— ${esc(data.shopName)}</p>`,
    };
  }

  return {
    subject: `AfterSale: ${template}`,
    html: `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`,
  };
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
