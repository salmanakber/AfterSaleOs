import type { Metadata } from "next";
import "@shopify/polaris/build/esm/styles.css";
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
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
      <body style={{ margin: 0, background: "#F8FAFC" }}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
