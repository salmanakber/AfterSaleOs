/**
 * Transactional email — Resend when configured; merchant templates from DB when present.
 */
import { sendTransactionalEmail } from "@aftersale/db";

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

export async function processEmailJob(data: {
  shopId: string;
  to: string;
  template: string;
  data: Record<string, unknown>;
}) {
  const started = Date.now();
  try {
    const result = await sendTransactionalEmail(data);
    if (!result.sent) {
      log("warn", "email.skipped", {
        reason: result.reason ?? "unknown",
        shopId: data.shopId,
        to: data.to,
        template: data.template,
        subject: result.subject,
        ms: Date.now() - started,
      });
      return;
    }
    log("info", "email.sent", {
      shopId: data.shopId,
      to: data.to,
      template: data.template,
      subject: result.subject,
      ms: Date.now() - started,
    });
  } catch (err) {
    log("error", "email.failed", {
      shopId: data.shopId,
      to: data.to,
      template: data.template,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    });
    throw err;
  }
}
