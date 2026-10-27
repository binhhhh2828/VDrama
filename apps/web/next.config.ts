import type { NextConfig } from "next";

// Khi chạy local (không có Caddy), chuyển /api/* sang FastAPI để giữ cùng một origin.
const apiProxyTarget = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` }];
  },
};

export default nextConfig;
