import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pricing — AfterSale OS",
  description:
    "AfterSale OS plans for Shopify: Free, Starter ($19), Growth ($49), and Pro ($99). Compare warranties, claims, branding, QR codes, and repairs.",
};

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
