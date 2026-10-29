import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.nav.news };

// Trang tin tức: giữ chỗ (nhãn Preview) để mục News trong menu không dẫn tới 404. Bản tĩnh theo ảnh 16
// làm ở bước R8 của docs/plans/gd3-netshort-ui.md.
export default function NewsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-8 pb-16 sm:px-6">
      <Badge kind="preview" className="self-start" />
      <h1 className="text-[28px] leading-tight font-bold">{copy.nav.news}</h1>
      <p className="text-[15px] leading-7 text-fg-soft">
        News and behind-the-scenes stories from VDrama will appear here soon.
      </p>
      <ButtonLink href="/browse" size="sm" className="self-start">
        Browse series
      </ButtonLink>
    </main>
  );
}
