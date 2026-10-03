import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

// Monorepo: load root .env so build/dev see DATABASE_URL / Shopify keys.
loadEnvConfig(path.join(__dirname, "../.."));

/** Absolute asset host so Shopify app-proxy HTML can load /_next bundles from the real app. */
const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@aftersale/db", "@aftersale/shared"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  ...(appUrl ? { assetPrefix: appUrl } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
