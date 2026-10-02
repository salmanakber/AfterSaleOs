import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "AfterSale OS",
  description: "Warranty registration and claims for Shopify",
};

/** Minimal root shell — merchant and customer route groups own their chrome. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        {/* Loaded globally; only initializes when merchant layout injects shopify-api-key meta. */}
        <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
