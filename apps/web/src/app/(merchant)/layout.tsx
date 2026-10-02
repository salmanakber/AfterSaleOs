import "@shopify/polaris/build/esm/styles.css";
import "./merchant.css";
import { AppProviders } from "./providers";

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Sora:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <AppProviders>{children}</AppProviders>
    </>
  );
}
