import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "AfterSale OS",
  description: "Warranty registration and claims for Shopify",
};

/** Minimal root shell — merchant and customer route groups own their chrome. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

  return (
    <html lang="en">
      <head>
        {/* Must exist BEFORE app-bridge.js so NavMenu portals into Shopify admin correctly. */}
        <meta name="shopify-api-key" content={apiKey} />
      </head>
      <body style={{ margin: 0 }}>
        <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
