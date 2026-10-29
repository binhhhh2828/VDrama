import { PosterCard } from "@/components/ui/PosterCard";
import type { SeriesCard } from "@/lib/api/types";
import { seriesMeta } from "@/lib/format";

/**
 * Lưới poster: 3 cột trên điện thoại (theo canvas mobile), tự chia cột từ `sm`.
 * `ranked`: hiện nhãn TOP theo thứ tự; `markNew`: hiện nhãn NEW.
 */
export function PosterGrid({
  series,
  ranked = false,
  markNew = false,
  preloadFirst = 0,
}: {
  series: SeriesCard[];
  ranked?: boolean;
  markNew?: boolean;
  preloadFirst?: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-5">
      {series.map((s, i) => (
        <PosterCard
          key={s.id}
          href={`/series/${s.slug}`}
          title={s.title}
          posterUrl={s.poster_url}
          meta={seriesMeta(s)}
          rank={ranked ? i + 1 : undefined}
          isNew={markNew}
          preload={i < preloadFirst}
        />
      ))}
    </div>
  );
}
