import { PosterCard } from "@/components/ui/PosterCard";
import type { SeriesCard } from "@/lib/api/types";
import { IS_DEMO } from "@/lib/demo/config";

/**
 * Lưới poster theo NetShort (ảnh 18): 3 cột khoảng cách 10 trên điện thoại, tên phim chữ thường;
 * từ `sm` tự chia cột. `ranked`: nhãn TOP theo thứ tự; `markNew`: nhãn NEW.
 */
export async function PosterGrid({
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
  const extras = IS_DEMO ? (await import("@/lib/demo/extras")).demoExtras : null;
  return (
    <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-x-5 sm:gap-y-6">
      {series.map((s, i) => (
        <PosterCard
          key={s.id}
          variant="grid"
          href={`/series/${s.slug}`}
          title={s.title}
          posterUrl={s.poster_url}
          genres={s.genres.map((g) => g.name)}
          rank={ranked ? i + 1 : undefined}
          isNew={markNew}
          original={extras?.(s.slug).badge === "original"}
          preload={i < preloadFirst}
        />
      ))}
    </div>
  );
}
