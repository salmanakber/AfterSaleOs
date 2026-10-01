import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/admin",
  transpilePackages: ["@aftersale/db", "@aftersale/shared"],
};

export default nextConfig;
