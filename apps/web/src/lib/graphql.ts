import { clearSessionTokenCache, merchantAuthHeaders } from "./session-token";
import { friendlyError } from "./merchant-errors";

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

  let json: { data?: T; errors?: { message?: string }[] };
  try {
    json = await res.json();
  } catch {
    throw new Error(friendlyError("Network error"));
  }

  if (json.errors?.length) {
    const first = json.errors[0];
    const msg = String(first?.message ?? "GraphQL error");
    if (msg.includes("UNAUTHORIZED") || msg.includes("SESSION_TOKEN")) {
      clearSessionTokenCache();
      const retry = await once();
      const retryJson = (await retry.json()) as { data?: T; errors?: { message?: string }[] };
      if (retryJson.errors?.length) {
        throw new Error(friendlyError(retryJson.errors[0]?.message ?? "UNAUTHORIZED"));
      }
      return retryJson.data as T;
    }
    throw new Error(friendlyError(msg));
  }
  return json.data as T;
}
