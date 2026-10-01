import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

// Monorepo: load root .env so build/dev see DATABASE_URL / Shopify keys.
loadEnvConfig(path.join(__dirname, "../.."));

const nextConfig: NextConfig = {
  transpilePackages: ["@aftersale/db", "@aftersale/shared"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
