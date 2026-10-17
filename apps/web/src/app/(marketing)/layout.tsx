import type { Metadata } from "next";
import "./marketing.css";

export const metadata: Metadata = {
  title: "AfterSale OS — Warranty & claims for Shopify brands",
  description:
    "Register products, run warranties, and resolve claims in one branded client portal. Built for Shopify merchants.",
  openGraph: {
    title: "AfterSale OS",
    description: "Warranty registration and claims for Shopify — portal, certificates, and care in one place.",
    url: "https://aftersale.tidyflowapp.com",
    siteName: "AfterSale OS",
    type: "website",
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div className="font-[Inter,ui-sans-serif,system-ui,sans-serif]">{children}</div>
    </>
  );
}
