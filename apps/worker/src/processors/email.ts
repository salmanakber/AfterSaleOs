/**
 * Transactional email stub — wire Resend/Postmark/SES in M3.
 */
export async function processEmailJob(data: {
  shopId: string;
  to: string;
  template: string;
  data: Record<string, unknown>;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log("[email] skipped (no RESEND_API_KEY)", {
      to: data.to,
      template: data.template,
      shopId: data.shopId,
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
      subject: `AfterSale: ${data.template}`,
      html: `<pre>${JSON.stringify(data.data, null, 2)}</pre>`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend failed: ${await res.text()}`);
  }
}
