import Image from "next/image";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Badge } from "@/components/ui/Badge";
import { getServerT, titleMetadata } from "@/lib/i18n/server";
import type { TKey } from "@/lib/i18n/translate";
import { NEWS_ARTICLES, newsCoverUrl } from "@/lib/news-data";

export const generateMetadata = titleMetadata("nav.news");

// Trang tin tức tĩnh theo ảnh 16: thẻ bài viết có ảnh bìa, nhãn, ngày • tác giả, tiêu đề, trích đoạn.
// PREVIEW: bài viết mẫu (lib/news-data.ts), chưa có API hay trang chi tiết bài.
export default async function NewsPage({ params }: PageProps<"/[lang]/news">) {
  const { t } = getServerT((await params).lang);
  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col px-4 pb-16 sm:px-6">
      <Breadcrumb items={[{ label: t("nav.home"), href: "/" }, { label: t("nav.news") }]} />
      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-[28px] leading-9 font-bold">{t("nav.news")}</h1>
        <Badge kind="preview" />
      </div>
      <p className="mt-1 text-sm text-muted">{t("news.sampleNote")}</p>

      <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {NEWS_ARTICLES.map((a, i) => (
          <li key={a.slug}>
            <article className="overflow-hidden rounded-[18px] bg-surface">
              <div className="relative aspect-video bg-art">
                <Image
                  src={newsCoverUrl(a.slug)}
                  alt=""
                  fill
                  preload={i === 0}
                  sizes="(min-width: 1024px) 420px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
                <span className="absolute top-3.5 left-3.5 max-w-[70%] truncate rounded-full bg-[#d61fe0] px-3 py-1 text-[13px] font-medium text-white">
                  {t(`news.${a.key}Tag` as TKey)}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-4">
                <p className="text-sm text-muted">
                  <time dateTime={a.date}>{a.date}</time> •{" "}
                  {t("news.by", { author: t("news.team") })}
                </p>
                <h2 className="text-lg leading-snug font-semibold">
                  {t(`news.${a.key}Title` as TKey)}
                </h2>
                <p className="line-clamp-3 text-[15px] leading-6 text-muted">
                  {t(`news.${a.key}Excerpt` as TKey)}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </main>
  );
}
