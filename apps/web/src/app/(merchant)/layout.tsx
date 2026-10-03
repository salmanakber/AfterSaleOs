import Script from "next/script";
import "@shopify/polaris/build/esm/styles.css";
import "./merchant.css";
import { AppProviders } from "./providers";

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        strategy="beforeInteractive"
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <AppProviders>{children}</AppProviders>
    </>
  );
}
