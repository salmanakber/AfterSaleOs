import "@shopify/shopify-api/adapters/node";
import {
  shopifyApi,
  ApiVersion,
  LogSeverity,
  Session,
  type Shopify,
} from "@shopify/shopify-api";
import { shopifySessionStorage, sessionRepository, prisma, getShopifySessionStorage } from "@aftersale/db";

import { normalizeShopDomain, offlineSessionId } from "@aftersale/shared";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

// Non-empty fallbacks keep `next build` page-data collection from crashing when
// real Shopify credentials are not configured yet (placeholders still work at runtime only for structure).
export const shopify: Shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "build-placeholder-api-key",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "build-placeholder-api-secret",
  scopes: (process.env.SHOPIFY_SCOPES ?? "read_products,read_orders,read_customers,write_draft_orders").split(","),
  hostName: appUrl.replace(/^https?:\/\//, ""),
  hostScheme: appUrl.startsWith("https") ? "https" : "http",
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: true,
  logger: { level: LogSeverity.Warning },
});

export const sessionStorage = shopifySessionStorage;

// Prefer getShopifySessionStorage() for new call sites — avoids build-time DB polls.
export { getShopifySessionStorage };


export class SessionTokenStaleError extends Error {
  readonly code = "SESSION_TOKEN_STALE" as const;
  constructor(message = "Shopify session token expired. Retry with a fresh token.") {
    super(message);
    this.name = "SessionTokenStaleError";
  }
}

function sessionFromRow(row: {
  id: string;
  shop: string;
  state: string;
  isOnline: boolean;
  accessToken: string;
  scope?: string | null;
  expires?: Date | null;
  refreshToken?: string | null;
  refreshTokenExpires?: Date | null;
}) {
  const session = new Session({
    id: row.id,
    shop: row.shop,
    state: row.state,
    isOnline: row.isOnline,
    accessToken: row.accessToken,
    scope: row.scope ?? undefined,
    expires: row.expires ?? undefined,
  });
  if (row.refreshToken) {
    (session as Session & { refreshToken?: string }).refreshToken = row.refreshToken;
  }
  if (row.refreshTokenExpires) {
    (session as Session & { refreshTokenExpires?: Date }).refreshTokenExpires =
      row.refreshTokenExpires;
  }
  return session;
}

function expiresAtFrom(expiresIn: unknown): Date | undefined {
  const seconds = Number(expiresIn);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return new Date(Date.now() + seconds * 1000);
}

type SessionWithRefresh = Session & {
  refreshToken?: string;
  refreshTokenExpires?: Date;
};

/**
 * PrismaSessionStorage (shopify-app-session-storage-prisma@6) does not persist
 * refreshToken / refreshTokenExpires. Expiring offline tokens require both, so
 * we store the base session then patch refresh fields ourselves.
 */
export async function persistShopifySession(session: Session): Promise<void> {
  await sessionStorage.storeSession(session);
  const withRefresh = session as SessionWithRefresh;
  const refreshToken = withRefresh.refreshToken ?? null;
  const refreshTokenExpires = withRefresh.refreshTokenExpires ?? null;
  if (!refreshToken && !refreshTokenExpires) return;
  try {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken,
        refreshTokenExpires,
      },
    });
  } catch (err) {
    console.warn("[shopify] failed to persist refresh token fields", session.id, err);
  }
}

export async function requireValidSessionToken(sessionToken: string): Promise<{
  shop: string;
  payload: Awaited<ReturnType<typeof shopify.session.decodeSessionToken>>;
}> {
  try {
    const payload = await shopify.session.decodeSessionToken(sessionToken);
    const dest = String(payload.dest ?? "")
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    if (!dest) throw new SessionTokenStaleError("Session token is missing shop destination.");
    const apiKey = process.env.SHOPIFY_API_KEY ?? "";
    const aud = payload.aud;
    const audOk = Array.isArray(aud) ? aud.includes(apiKey) : aud === apiKey;
    if (!audOk) {
      throw new Error("RECONNECT_REQUIRED: Session token aud mismatch. Re-authorize the app.");
    }
    return { shop: dest, payload };
  } catch (err) {
    if (err instanceof SessionTokenStaleError) throw err;
    if (err instanceof Error && err.message.includes("RECONNECT_REQUIRED")) throw err;
    throw new SessionTokenStaleError(err instanceof Error ? err.message : "Invalid session token");
  }
}

export async function exchangeSessionToken(
  shop: string,
  sessionToken: string,
  requested: "online" | "offline" = "offline",
): Promise<Session> {
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const apiSecret = process.env.SHOPIFY_API_SECRET ?? "";
  if (!apiKey || !apiSecret) throw new Error("Shopify API credentials are not configured.");

  const { shop: exchangeShop } = await requireValidSessionToken(sessionToken);
  const shopDomain = normalizeShopDomain(exchangeShop || shop);

  const requestedTokenType =
    requested === "offline"
      ? "urn:shopify:params:oauth:token-type:offline-access-token"
      : "urn:shopify:params:oauth:token-type:online-access-token";

  // Public apps must use expiring offline tokens for Admin API.
  const body = new URLSearchParams({
    client_id: apiKey,
    client_secret: apiSecret,
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: sessionToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    requested_token_type: requestedTokenType,
  });
  if (requested === "offline") body.set("expiring", "1");

  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400) throw new SessionTokenStaleError(`Token exchange failed: ${text}`);
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    scope?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };

  const session = new Session({
    id: requested === "offline" ? offlineSessionId(shopDomain) : `online_${shopDomain}_${Date.now()}`,
    shop: shopDomain,
    state: "",
    isOnline: requested === "online",
    accessToken: json.access_token,
    scope: json.scope,
    expires: expiresAtFrom(json.expires_in),
  });
  if (json.refresh_token) {
    (session as SessionWithRefresh).refreshToken = json.refresh_token;
  }
  if (json.refresh_token_expires_in) {
    (session as SessionWithRefresh).refreshTokenExpires = expiresAtFrom(
      json.refresh_token_expires_in,
    );
  }

  await persistShopifySession(session);
  return session;
}

/** Refresh an expiring offline access token using the stored refresh_token. */
export async function refreshOfflineAccessToken(shop: string, refreshToken: string): Promise<Session> {
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const apiSecret = process.env.SHOPIFY_API_SECRET ?? "";
  if (!apiKey || !apiSecret) throw new Error("Shopify API credentials are not configured.");

  const shopDomain = normalizeShopDomain(shop);
  const body = new URLSearchParams({
    client_id: apiKey,
    client_secret: apiSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new SessionTokenStaleError(`Offline token refresh failed: ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    scope?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };

  const existingRow = await sessionRepository.getOfflineSession(shopDomain);
  const session = new Session({
    id: offlineSessionId(shopDomain),
    shop: shopDomain,
    state: existingRow?.state ?? "",
    isOnline: false,
    accessToken: json.access_token,
    scope: json.scope ?? existingRow?.scope ?? undefined,
    expires: expiresAtFrom(json.expires_in),
  });
  const nextRefresh = json.refresh_token || refreshToken;
  (session as SessionWithRefresh).refreshToken = nextRefresh;
  if (json.refresh_token_expires_in) {
    (session as SessionWithRefresh).refreshTokenExpires = expiresAtFrom(
      json.refresh_token_expires_in,
    );
  } else if (existingRow?.refreshTokenExpires) {
    (session as SessionWithRefresh).refreshTokenExpires = existingRow.refreshTokenExpires;
  }

  await persistShopifySession(session);
  return session;
}

export async function getOfflineSession(shop: string): Promise<Session | undefined> {
  const domain = normalizeShopDomain(shop);
  const row = await sessionRepository.getOfflineSession(domain);
  if (!row?.accessToken) return undefined;
  let session = sessionFromRow(row);

  // Expiring offline tokens (~1h): refresh before Admin API rejects them.
  const expiresAt = session.expires?.getTime() ?? 0;
  const needsRefresh = expiresAt > 0 && expiresAt < Date.now() + 60_000;
  if (needsRefresh) {
    const refreshToken = (session as Session & { refreshToken?: string }).refreshToken;
    if (refreshToken) {
      try {
        session = await refreshOfflineAccessToken(domain, refreshToken);
      } catch (err) {
        console.warn("[shopify] offline token refresh failed", err);
        return undefined;
      }
    } else {
      // Legacy non-expiring token that Shopify now rejects — force re-auth.
      return undefined;
    }
  }

  return session;
}

export async function getShopGraphqlClient(shop: string) {
  const session = await getOfflineSession(shop);
  if (!session) throw new Error(`No offline session for ${shop}. Reconnect required.`);
  return new shopify.clients.Graphql({ session });
}

export async function shopifyGraphqlRequest<T = unknown>(
  shop: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const client = await getShopGraphqlClient(shop);
  const response = await client.request(query, { variables });
  return response.data as T;
}

export async function ensureFreshOfflineSession(shop: string, sessionToken?: string | null) {
  const existing = await getOfflineSession(shop);
  if (existing?.accessToken) {
    const expires = existing.expires;
    if (!expires || expires.getTime() > Date.now() + 60_000) return existing;
  }
  if (!sessionToken) {
    if (existing) return existing;
    throw new SessionTokenStaleError("No offline session and no session token to exchange.");
  }
  return exchangeSessionToken(shop, sessionToken, "offline");
}

export async function deleteShopSessions(shop: string) {
  await sessionRepository.deleteSessionsForShop(normalizeShopDomain(shop));
}

export { prisma };
