import type { Metadata } from "next";
import "@shopify/polaris/build/esm/styles.css";
import "./merchant.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "AfterSale OS",
  description: "Warranty registration and claims for Shopify",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

  return (
    <html lang="en">
      <head>
        <meta name="shopify-api-key" content={apiKey} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Sora:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
      <body style={{ margin: 0 }}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
