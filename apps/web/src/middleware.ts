import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Allow embedding in Shopify admin iframe; normalize trailing slashes that App Bridge adds. */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Shopify NavMenu sometimes requests /settings/ which 404s in the App Router.
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
  );
  response.headers.delete("X-Frame-Options");

  // Preserve query string on redirects above; help cache static shells
  if (search) {
    response.headers.set("Vary", "Cookie");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
