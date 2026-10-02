import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isCustomerSurface(pathname: string) {
  return (
    pathname.startsWith("/apps/aftersale") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/q/")
  );
}

/** Allow embedding in Shopify admin / storefront; customer pages also embeddable anywhere. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Shopify NavMenu sometimes requests /settings/ which 404s in the App Router.
  if (pathname.length > 1 && pathname.endsWith("/") && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(url);
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

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
