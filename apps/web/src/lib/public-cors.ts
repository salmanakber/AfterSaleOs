import { NextResponse } from "next/server";

/** Allow storefront / theme JS to call public AfterSale APIs cross-origin. */
export function withPublicCors(response: NextResponse, requestOrigin?: string | null) {
  // Themes run on *.myshopify.com and custom domains — reflect a safe origin or *.
  const origin = requestOrigin && requestOrigin !== "null" ? requestOrigin : "*";
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Accept, Content-Type");
  response.headers.set("Access-Control-Max-Age", "86400");
  if (origin !== "*") {
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export function publicCorsPreflight(requestOrigin?: string | null) {
  return withPublicCors(new NextResponse(null, { status: 204 }), requestOrigin);
}
