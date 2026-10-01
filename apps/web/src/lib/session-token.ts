let cached: { token: string; exp: number } | null = null;

export async function getSessionToken(): Promise<string | null> {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  if (typeof window === "undefined" || !window.shopify?.idToken) return null;
  const token = await window.shopify.idToken();
  // ID tokens are short-lived (~60s); cache briefly
  cached = { token, exp: Date.now() + 45_000 };
  return token;
}

export function clearSessionTokenCache() {
  cached = null;
}
