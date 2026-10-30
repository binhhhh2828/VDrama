import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.nav.download };

// Trang tải app: VDrama chưa có app nên đây chỉ là trang giữ chỗ (nhãn Preview), để mục Download trong
// menu không dẫn tới 404. Làm trang thật khi có app.
export default function DownloadPage() {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-8 pb-16 sm:px-6">
      <Badge kind="preview" className="self-start" />
      <h1 className="text-[28px] leading-tight font-bold">{copy.nav.download}</h1>
      <p className="text-[15px] leading-7 text-fg-soft">
        The VDrama app is not available yet. For now you can watch every episode right in your
        browser on any phone or computer. Nothing to install.
      </p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/browse" size="sm">
          Browse series
        </ButtonLink>
        <ButtonLink href="/vip" variant="vip" size="sm">
          Get VIP
        </ButtonLink>
      </div>
    </main>
  );
}
