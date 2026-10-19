import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isCustomerSurface(pathname: string) {
  return (
    pathname.startsWith("/apps/aftersale") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/api/staff/") ||
    pathname.startsWith("/staff/") ||
    pathname.startsWith("/q/")
  );
}

function isShopifyAdminEntry(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  return (
    q.has("shop") ||
    q.has("host") ||
    q.has("id_token") ||
    q.has("session") ||
    q.get("embedded") === "1"
  );
}

/** Allow embedding in Shopify admin / storefront; customer pages also embeddable anywhere. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public marketing site on the apex URL; Shopify Admin still loads /?shop=&host=.
  // Redirect (not rewrite): the prod gateway sets Host to 127.0.0.1, so absolute
  // rewrites become https://localhost:… and fail TLS when Next proxies them.
  if (pathname === "/" && !isShopifyAdminEntry(request)) {
    const publicOrigin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      request.nextUrl.origin;
    const dest = new URL("/welcome", publicOrigin);
    dest.search = request.nextUrl.search;
    const redirect = NextResponse.redirect(dest);
    redirect.headers.delete("X-Frame-Options");
    redirect.headers.set("Content-Security-Policy", "frame-ancestors 'none';");
    return redirect;
  }

  // Shopify NavMenu sometimes requests /settings/ which 404s in the App Router.
  if (pathname.length > 1 && pathname.endsWith("/") && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(url);
  }

  // Storefront theme JS (cross-origin) calling public fee/branding APIs.
  if (request.method === "OPTIONS" && pathname.startsWith("/api/public/")) {
    const preflight = new NextResponse(null, { status: 204 });
    const origin = request.headers.get("origin") || "*";
    preflight.headers.set("Access-Control-Allow-Origin", origin);
    preflight.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    preflight.headers.set("Access-Control-Allow-Headers", "Accept, Content-Type");
    preflight.headers.set("Access-Control-Max-Age", "86400");
    return preflight;
  }

  const response = NextResponse.next();
  response.headers.delete("X-Frame-Options");

  if (isCustomerSurface(pathname)) {
    // Hosted + storefront + arbitrary embed parents (help centers, LP builders, etc.)
    response.headers.set("Content-Security-Policy", "frame-ancestors *;");
  } else {
    response.headers.set(
      "Content-Security-Policy",
      "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://*.account.google.com;",
    );
  }

  if (pathname.startsWith("/api/public/") || pathname === "/apps/aftersale/fee") {
    const origin = request.headers.get("origin");
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");
    } else {
      response.headers.set("Access-Control-Allow-Origin", "*");
    }
    response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
