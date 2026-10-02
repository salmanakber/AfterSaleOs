/** Map raw GraphQL / API errors to merchant-facing copy. */
export function friendlyError(err: unknown, fallback = "Something went wrong. Try again."): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = raw.trim();
  if (!msg) return fallback;

  const lower = msg.toLowerCase();

  if (lower.includes("unauthorized") || lower.includes("session_token") || lower.includes("missing session")) {
    return "Your Shopify session expired. Reload the app and try again.";
  }
  if (lower.includes("staff seat") || lower.includes("seat limit")) {
    return msg; // already merchant-friendly from the API
  }
  if (lower.includes("not included on your current plan") || lower.includes("upgrade")) {
    return msg;
  }
  if (lower.includes("not found")) {
    return "That record was not found. It may have been removed — refresh and try again.";
  }
  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("failed to fetch")) {
    return "Network error. Check your connection and try again.";
  }

  // Strip GraphQL prefix noise
  return msg.replace(/^GraphQL error:\s*/i, "").replace(/^Error:\s*/i, "") || fallback;
}
