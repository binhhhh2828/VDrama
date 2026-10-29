import { PosterCard } from "@/components/ui/PosterCard";
import type { SeriesCard } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { IS_DEMO } from "@/lib/demo/config";

/**
 * Hàng poster cuộn ngang theo NetShort (ảnh 02, 03): thẻ 3:4 rộng ≈118px ở màn 430, khoảng cách 10,
 * lề trái 22, luôn thấy 3 thẻ và phần thẻ thứ 4 thò ra để người xem biết còn vuốt được. Tràn hai mép
 * trang (bù lề của khung chứa) trên điện thoại; từ `sm` thành hàng thường trong khung.
 */
export async function PosterRow({
  series,
  ranked = false,
  markNew = false,
  preloadFirst = 0,
  className,
}: {
  series: SeriesCard[];
  ranked?: boolean;
  markNew?: boolean;
  preloadFirst?: number;
  className?: string;
}) {
  const extras = IS_DEMO ? (await import("@/lib/demo/extras")).demoExtras : null;
  return (
    <ul
      className={cn(
        "-mx-4 flex snap-x snap-proximity gap-2.5 overflow-x-auto overscroll-x-contain px-[22px] pb-1 [scroll-padding-inline:22px] [scrollbar-width:none] sm:mx-0 sm:px-0 sm:[scroll-padding-inline:0] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {series.map((s, i) => (
        <li
          key={s.id}
          className="w-[calc((100vw-76px)/3)] shrink-0 snap-start sm:w-[170px] md:w-[190px]"
        >
          <PosterCard
            href={`/series/${s.slug}`}
            title={s.title}
            posterUrl={s.poster_url}
            genres={s.genres.map((g) => g.name)}
            rank={ranked ? i + 1 : undefined}
            isNew={markNew}
            original={extras?.(s.slug).badge === "original"}
            preload={i < preloadFirst}
          />
        </li>
      ))}
    </ul>
  );
}
