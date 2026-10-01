/** Admin is served under /admin on the public domain. */
export const BASE_PATH = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || "/admin";

export function adminApi(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${p}`;
}

export function adminHref(path: string): string {
  return adminApi(path);
}
