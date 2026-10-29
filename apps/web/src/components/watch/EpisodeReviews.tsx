import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { copy } from "@/lib/copy";

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
        <h2 id="reviews-h" className="flex items-center gap-3 text-[26px] leading-8 font-bold">
          {copy.watch.reviews}
          <Badge kind="preview" />
        </h2>
        <Link href={seriesHref} className="text-sm font-medium no-underline">
          {copy.watch.seeMore}
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {reviews.map((r) => (
          <li key={r.title} className="rounded-[14px] bg-surface p-4">
            <h3 className="text-base font-semibold">{r.title}</h3>
            <p className="mt-2 text-sm leading-6 text-fg-soft">{r.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
