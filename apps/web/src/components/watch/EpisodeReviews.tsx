import { Badge } from "@/components/ui/Badge";
import { copy } from "@/lib/copy";
import { Link } from "@/components/i18n/navigation";

export type Review = { title: string; body: string };

/**
 * "Episode Reviews" (ảnh 12–14): bài đánh giá biên tập, tĩnh. API chưa có nên chỉ hiện ở bản demo với
 * văn bản mẫu (nhãn PREVIEW).
 */
export function EpisodeReviews({ reviews, seriesHref }: { reviews: Review[]; seriesHref: string }) {
  if (reviews.length === 0) return null;
  return (
    <section aria-labelledby="reviews-h" className="flex flex-col gap-4 px-[13px]">
      <div className="flex items-center justify-between gap-3">
        <h2 id="reviews-h" className="flex items-center gap-3 text-xl leading-7 font-bold">
          {copy.watch.reviews}
          <Badge kind="preview" />
        </h2>
        <Link href={seriesHref} className="text-[13px] font-medium no-underline">
          {copy.watch.seeMore}
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {reviews.map((r) => (
          <li key={r.title} className="rounded-[14px] bg-surface p-3.5">
            <h3 className="text-sm font-semibold">{r.title}</h3>
            <p className="mt-1.5 text-[13px] leading-5 text-fg-soft">{r.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
