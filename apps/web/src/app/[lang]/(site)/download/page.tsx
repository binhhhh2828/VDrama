import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { getServerT, titleMetadata } from "@/lib/i18n/server";

export const generateMetadata = titleMetadata("nav.download");

// Trang tải app: VDrama chưa có app nên đây chỉ là trang giữ chỗ (nhãn Preview), để mục Download trong
// menu không dẫn tới 404. Làm trang thật khi có app.
export default async function DownloadPage({ params }: PageProps<"/[lang]/download">) {
  const { t } = getServerT((await params).lang);
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pt-8 pb-16 sm:px-6">
      <Badge kind="preview" className="self-start" />
      <h1 className="text-[28px] leading-tight font-bold">{t("nav.download")}</h1>
      <p className="text-[15px] leading-7 text-fg-soft">{t("download.text")}</p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/browse" size="sm">
          {t("notFound.browse")}
        </ButtonLink>
        <ButtonLink href="/vip" variant="vip" size="sm">
          {t("promo.getVip")}
        </ButtonLink>
      </div>
    </main>
  );
}
