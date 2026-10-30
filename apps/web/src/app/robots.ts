import type { MetadataRoute } from "next";
import { IS_DEMO } from "@/lib/demo/config";
import { LOCALES } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/paths";

const ORIGIN = (process.env.PUBLIC_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");

// robots.txt: chặn trang riêng tư, trang đăng nhập, admin, API và trang dev.
export default function robots(): MetadataRoute.Robots {
  // Bản demo công khai chỉ để sếp xem: không cho công cụ tìm kiếm lập chỉ mục.
  if (IS_DEMO) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/dev/",
        // Các trang riêng tư có ở mọi ngôn ngữ (`/account`, `/vi/account`...).
        ...LOCALES.flatMap((locale) =>
          [
            "/account",
            "/signin",
            "/signup",
            "/forgot-password",
            "/reset-password",
            "/verify-email",
            "/vip/checkout",
            "/search",
          ].map((path) => localePath(locale, path)),
        ),
      ],
    },
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}
