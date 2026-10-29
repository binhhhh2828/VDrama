import { Suspense, type ReactNode } from "react";
import { ContinueWatching } from "@/components/home/ContinueWatching";
import { HeroCarousel, HeroFallback, HeroSkeleton } from "@/components/home/HeroCarousel";
import type { HeroSlide } from "@/components/home/HeroCarousel";
import { SectionHeader } from "@/components/home/SectionHeader";
import { PosterRow } from "@/components/series/PosterRow";
import { PosterRowSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { listSeries } from "@/lib/api/catalog";
import type { SeriesCard } from "@/lib/api/types";
import { copy } from "@/lib/copy";
import { IS_DEMO } from "@/lib/demo/config";

// Trang chủ theo NetShort (ảnh 01–04). Phần catalog lấy trên server (HTML có sẵn tên phim, cache vài
// phút); phần riêng của người xem (Continue watching) lấy trên trình duyệt. Mỗi hàng có Suspense
// riêng để hàng nào xong trước hiện trước.

/** Mỗi hàng 6 phim; "You May Like" lấy các phim hot xếp sau 6 phim đầu. */
const ROW = 6;

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <h1 className="sr-only">VDrama: short AI dramas</h1>
      {/* Hero tràn hai mép, nằm dưới header trong suốt; phần còn lại có lề như cũ. */}
      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-16 px-4 pt-8 pb-16 sm:px-6">
        <ContinueWatching />

        <Suspense fallback={<RowSkeleton />}>
          <HotRow />
        </Suspense>
        <Suspense fallback={<RowSkeleton />}>
          <NewRow />
        </Suspense>
        <Suspense fallback={<RowSkeleton />}>
          <ForYouRow />
        </Suspense>
        {/* Cờ "độc quyền" chỉ có ở dữ liệu demo (API thật chưa có) nên hàng này chỉ có ở bản demo. */}
        {IS_DEMO ? (
          <Suspense fallback={<RowSkeleton />}>
            <OriginalsRow />
          </Suspense>
        ) : null}
      </div>
    </main>
  );
}

async function Hero() {
  const { items } = await listSeries({ withBanner: true, limit: 6 });
  if (items.length === 0) return <HeroFallback />;
  // Nhãn HOT chỉ có ở dữ liệu demo (API thật chưa có); nạp động để bản thật không kéo dữ liệu mẫu vào.
  const demoExtras = IS_DEMO ? (await import("@/lib/demo/extras")).demoExtras : null;
  const slides: HeroSlide[] = items.map((s) => ({
    slug: s.slug,
    title: s.title,
    bannerUrl: s.banner_url,
    hot: demoExtras?.(s.slug).badge === "hot",
  }));
  return <HeroCarousel slides={slides} />;
}

/** Một hàng trang chủ: tiêu đề + hàng poster. Không có phim thì không vẽ gì (cả tiêu đề). */
function HomeRow({
  id,
  title,
  items,
  preloadFirst,
}: {
  id: string;
  title: string;
  items: SeriesCard[];
  preloadFirst?: number;
}): ReactNode {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-8">
      <SectionHeader id={id} title={title} />
      <PosterRow series={items} preloadFirst={preloadFirst} />
    </section>
  );
}

function RowSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="ml-4 h-6 w-44 rounded-md sm:ml-0" />
      <PosterRowSkeleton />
    </div>
  );
}

async function HotRow() {
  const { items } = await listSeries({ sort: "hot", limit: ROW * 2 });
  return <HomeRow id="hot-h" title={copy.home.hot} items={items.slice(0, ROW)} preloadFirst={3} />;
}

async function NewRow() {
  const { items } = await listSeries({ sort: "new", limit: ROW });
  return <HomeRow id="new-h" title={copy.home.newReleases} items={items} />;
}

async function ForYouRow() {
  const { items } = await listSeries({ sort: "hot", limit: ROW * 2 });
  return <HomeRow id="foryou-h" title={copy.home.forYou} items={items.slice(ROW)} />;
}

async function OriginalsRow() {
  const [{ items }, { demoExtras }] = await Promise.all([
    listSeries({ sort: "hot", limit: 50 }),
    import("@/lib/demo/extras"),
  ]);
  const originals = items.filter((s) => demoExtras(s.slug).badge === "original").slice(0, ROW);
  return <HomeRow id="originals-h" title={copy.home.originals} items={originals} />;
}
