import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { NotFoundContent } from "@/components/layout/NotFoundContent";

export const metadata: Metadata = { title: "404" };

// 404 cho mọi đường dẫn không có (và khi trang gọi notFound()); chữ theo ngôn ngữ của trang.
export default function NotFound() {
  return (
    <SiteShell>
      <NotFoundContent />
    </SiteShell>
  );
}
