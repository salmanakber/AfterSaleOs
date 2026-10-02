import { clearSessionTokenCache, merchantAuthHeaders } from "./session-token";

export async function gqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  async function once(): Promise<Response> {
    const headers = await merchantAuthHeaders();
    return fetch("/api/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
  }

  let res = await once();
  if (res.status === 401) {
    clearSessionTokenCache();
    res = await once();
  }

  const json = await res.json();
  if (json.errors?.length) {
    const msg = String(json.errors[0].message ?? "GraphQL error");
    if (msg.includes("UNAUTHORIZED") || msg.includes("SESSION_TOKEN")) {
      clearSessionTokenCache();
      const retry = await once();
      const retryJson = await retry.json();
      if (retryJson.errors?.length) {
        throw new Error(retryJson.errors[0].message ?? "GraphQL error");
      }
      return retryJson.data as T;
    }
    throw new Error(msg);
  }
  return json.data as T;
}
