"use client";

import { ButtonLink } from "@/components/ui/Button";
import { PlayIcon } from "@/components/ui/icons";
import { PosterArt } from "@/components/ui/PosterArt";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SeriesCard } from "@/lib/api/types";
import { GenreList } from "@/components/i18n/GenreName";
import { useT } from "@/components/i18n/I18nProvider";
import { highlight } from "@/lib/highlight";
import { Link } from "@/components/i18n/navigation";

/** Văn bản có phần khớp từ khóa tô màu accent. */
function Highlighted({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlight(text, q).map((p, i) =>
        p.match ? (
          <span key={i} className="text-accent">
            {p.text}
          </span>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

/**
 * Kết quả tìm kiếm dạng danh sách (ảnh 22): poster 3:4 bên trái; bên phải tên phim (từ khớp tô
 * accent), mô tả cắt 3 dòng, nhãn thể loại, nút "Play now" ở cuối cột.
 */
export function SearchResultList({
  items,
  descriptions,
  q,
}: {
  items: SeriesCard[];
  /** Mô tả theo slug (kết quả tìm kiếm của API không kèm mô tả). */
  descriptions: Record<string, string | null>;
  q: string;
}) {
  const t = useT();
  return (
    <ul className="flex flex-col gap-[26px]">
      {items.map((s, i) => {
        const description = descriptions[s.slug];
        return (
          <li key={s.id} className="flex gap-3.5">
            <Link
              href={`/series/${s.slug}`}
              tabIndex={-1}
              aria-hidden
              className="w-[43%] max-w-[190px] shrink-0"
            >
              <PosterArt
                src={s.poster_url}
                title={s.title}
                sizes="(min-width: 640px) 190px, 40vw"
                preload={i < 4}
                className="rounded-card"
              />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="text-xl leading-7 font-semibold">
                <Link href={`/series/${s.slug}`} className="text-fg no-underline hover:text-fg">
                  <Highlighted text={s.title} q={q} />
                </Link>
              </h3>
              {description ? (
                <p className="mt-2 line-clamp-3 text-[15px] leading-[26px] text-muted">
                  <Highlighted text={description} q={q} />
                </p>
              ) : null}
              {s.genres.length > 0 ? (
                <p className="mt-3 line-clamp-2 self-start rounded-2xl bg-[#2e2e2e] px-4 py-2 text-xs text-muted">
                  <GenreList genres={s.genres} separator=", " />
                </p>
              ) : null}
              <ButtonLink
                href={`/series/${s.slug}/episode/1`}
                variant="gradient"
                size="xs"
                className="mt-4 w-full max-w-[180px] self-end text-[15px] sm:mt-auto"
              >
                <PlayIcon size={14} /> {t("series.playNow")}
              </ButtonLink>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SearchResultSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-[26px]" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex gap-3.5">
          <Skeleton className="aspect-[3/4] w-[43%] max-w-[190px] shrink-0" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-6 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  );
}
