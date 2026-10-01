import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@aftersale/db", "@aftersale/shared"],
};

export default nextConfig;
