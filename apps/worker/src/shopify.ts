import "@shopify/shopify-api/adapters/node";
import {
  shopifyApi,
  ApiVersion,
  LogSeverity,
  Session,
  type Shopify,
} from "@shopify/shopify-api";
import { sessionRepository } from "@aftersale/db";
import { normalizeShopDomain, offlineSessionId } from "@aftersale/shared";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export const shopify: Shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY ?? "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET ?? "",
  scopes: (process.env.SHOPIFY_SCOPES ?? "read_products,read_orders,read_customers").split(","),
  hostName: appUrl.replace(/^https?:\/\//, ""),
  hostScheme: appUrl.startsWith("https") ? "https" : "http",
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: true,
  logger: { level: LogSeverity.Warning },
});

export async function shopifyGraphqlRequest<T = unknown>(
  shop: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const domain = normalizeShopDomain(shop);
  const row = await sessionRepository.getOfflineSession(domain);
  if (!row?.accessToken) throw new Error(`No offline session for ${domain}`);

  const session = new Session({
    id: offlineSessionId(domain),
    shop: domain,
    state: row.state,
    isOnline: false,
    accessToken: row.accessToken,
    scope: row.scope ?? undefined,
    expires: row.expires ?? undefined,
  });

  const client = new shopify.clients.Graphql({ session });
  const response = await client.request(query, { variables });
  return response.data as T;
}
