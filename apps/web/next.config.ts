import type { NextConfig } from "next";

// Khi chạy local (không có Caddy), chuyển /api/* sang FastAPI để giữ cùng một origin.
const apiProxyTarget = process.env.API_PROXY_TARGET;

// Bản demo trên Netlify dùng runtime của Netlify nên không đóng gói `standalone` (chỉ Docker cần).
const isDemo = process.env.NEXT_PUBLIC_DEMO === "true";

const nextConfig: NextConfig = {
  output: isDemo ? undefined : "standalone",
  // Cho phép mở bản dev từ điện thoại cùng mạng (iPhone hotspot dùng dải 172.20.10.x, wifi nhà thường 192.168.x.x).
  allowedDevOrigins: ["172.20.10.*", "192.168.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    qualities: [75],
    // Ảnh giữ chỗ của seed-demo (picsum chuyển hướng sang fastly.picsum.photos, Next tự theo).
    // Khi ảnh chuyển sang R2/Cloudflare Images (Giai đoạn 4) thì thêm domain đó.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos", pathname: "/seed/**", search: "" },
    ],
  },
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
