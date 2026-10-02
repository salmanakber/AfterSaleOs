"use client";

import { useEffect } from "react";

/** Injects Shopify App Bridge api key meta into document head (merchant only). */
export function ShopifyMeta({ apiKey }: { apiKey: string }) {
  useEffect(() => {
    if (!apiKey) return;
    let meta = document.querySelector('meta[name="shopify-api-key"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "shopify-api-key");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", apiKey);
  }, [apiKey]);
  return null;
}
