import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AfterSale OS",
  description: "Warranty registration and claims for Shopify",
};

/** Minimal root shell — merchant layout loads App Bridge; customer routes stay clean. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

  return (
    <html lang="en">
      <head>
        {/* Merchant NavMenu needs this meta before App Bridge (loaded in merchant layout). */}
        <meta name="shopify-api-key" content={apiKey} />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
