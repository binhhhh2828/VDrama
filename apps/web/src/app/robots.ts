import type { MetadataRoute } from "next";

const ORIGIN = (process.env.PUBLIC_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");

// robots.txt: chặn trang riêng tư, trang đăng nhập, admin, API và trang dev.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/account",
        "/signin",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/vip/checkout",
        "/search",
        "/dev/",
      ],
    },
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}
