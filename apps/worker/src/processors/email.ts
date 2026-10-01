/**
 * Transactional email stub — wire Resend/Postmark/SES for production.
 */
export async function processEmailJob(data: {
  shopId: string;
  to: string;
  template: string;
  data: Record<string, unknown>;
}) {
  const subject =
    data.template === "guest_magic_link"
      ? "Your warranty portal link"
      : `AfterSale: ${data.template}`;

  const html =
    data.template === "guest_magic_link"
      ? `<p>Use this one-time link to view your warranties (expires in 15 minutes):</p>
         <p><a href="${String(data.data.link ?? "")}">Open warranty portal</a></p>
         <p>Order: ${String(data.data.orderNumber ?? "")}</p>`
      : `<pre>${JSON.stringify(data.data, null, 2)}</pre>`;

  if (!process.env.RESEND_API_KEY) {
    console.log("[email] skipped (no RESEND_API_KEY)", {
      to: data.to,
      template: data.template,
      shopId: data.shopId,
      preview: data.template === "guest_magic_link" ? data.data.link : undefined,
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
