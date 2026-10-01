import { clearSessionTokenCache, getSessionToken } from "./session-token";

export async function gqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  async function once(): Promise<Response> {
    const token = await getSessionToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop");
    if (shop) headers["x-aftersale-shop"] = shop;

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
    throw new Error(json.errors[0].message ?? "GraphQL error");
  }
  return json.data as T;
}
