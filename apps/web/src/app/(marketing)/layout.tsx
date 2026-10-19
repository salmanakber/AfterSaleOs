import type { Metadata } from "next";
import "./marketing.css";

export const metadata: Metadata = {
  title: "AfterSale OS — Warranty registration & claims for Shopify",
  description:
    "Register products, run warranty rules, and resolve claims in one branded client portal. See pricing for Free, Starter, Growth, and Pro.",
  openGraph: {
    title: "AfterSale OS",
    description: "Warranty registration and claims for Shopify — portal, certificates, and care in one place.",
    url: "https://aftersale.tidyflowapp.com",
    siteName: "AfterSale OS",
    type: "website",
    images: [{ url: "https://aftersale.tidyflowapp.com/marketing/dashboard.png" }],
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
