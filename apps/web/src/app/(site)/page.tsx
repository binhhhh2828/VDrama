import Link from "next/link";
import { Suspense } from "react";
import { ContinueWatching } from "@/components/home/ContinueWatching";
import { HeroCarousel, HeroFallback, HeroSkeleton } from "@/components/home/HeroCarousel";
import type { HeroSlide } from "@/components/home/HeroCarousel";
import { SectionHeader } from "@/components/home/SectionHeader";
import { PosterGrid } from "@/components/series/PosterGrid";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { PosterGridSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { listGenres, listSeries } from "@/lib/api/catalog";
import { IS_DEMO } from "@/lib/demo/config";

// Trang chủ. Phần catalog lấy trên server (HTML có sẵn tên phim, cache vài phút); phần riêng của
// người xem (Continue watching) lấy trên trình duyệt. Mỗi mục có Suspense riêng để mục nào xong
// trước hiện trước.

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <h1 className="sr-only">VDrama: short AI dramas</h1>
      {/* Hero tràn hai mép, nằm dưới header trong suốt; phần còn lại có lề như cũ. */}
      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 px-4 pt-6 pb-16 sm:px-6 md:gap-12">
        <ContinueWatching />

        <section aria-labelledby="trending-h" className="flex flex-col gap-3 md:gap-4">
          <SectionHeader id="trending-h" title="Trending now" href="/browse?sort=hot" />
          <Suspense fallback={<PosterGridSkeleton count={6} />}>
            <Trending />
          </Suspense>
        </section>

        <section aria-labelledby="genres-h" className="flex flex-col gap-3 md:gap-4">
          <h2 id="genres-h" className="text-xl font-extrabold md:text-2xl">
            Browse by genre
          </h2>
          <Suspense fallback={<Skeleton className="h-11 w-full max-w-xl rounded-full" />}>
            <Genres />
          </Suspense>
        </section>

        <section aria-labelledby="new-h" className="flex flex-col gap-3 md:gap-4">
          <SectionHeader id="new-h" title="New releases" href="/browse?sort=new" />
          <Suspense fallback={<PosterGridSkeleton count={6} />}>
            <NewReleases />
          </Suspense>
        </section>

        <VipBand />
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

async function Trending() {
  const { items } = await listSeries({ sort: "hot", limit: 6 });
  return <PosterGrid series={items} ranked preloadFirst={3} />;
}

async function NewReleases() {
  const { items } = await listSeries({ sort: "new", limit: 6 });
  return <PosterGrid series={items} markNew />;
}

async function Genres() {
  const genres = await listGenres();
  return (
    <div className="flex flex-wrap gap-2 md:gap-2.5">
      <Chip href="/browse" active>
        All
      </Chip>
      {genres.map((g) => (
        <Chip key={g.slug} href={`/browse?genre=${g.slug}`}>
          {g.name}
        </Chip>
      ))}
    </div>
  );
}

function VipBand() {
  return (
    <section
      aria-labelledby="vip-band-h"
      className="flex flex-wrap items-center justify-between gap-5 rounded-panel border border-vip-line bg-vip-panel px-6 py-7 md:px-9 md:py-8"
    >
      <div className="flex max-w-[640px] flex-col gap-1.5">
        <span className="text-[13px] font-extrabold tracking-[0.1em] text-vip">VDRAMA VIP</span>
        <h2 id="vip-band-h" className="text-[22px] font-extrabold md:text-[26px]">
          Unlock every episode, ad-free, in Full HD
        </h2>
        <p className="text-[15px] text-muted">
          Your plan starts the moment payment goes through.{" "}
          <Link href="/vip" className="font-semibold">
            Compare plans
          </Link>
        </p>
      </div>
      <ButtonLink href="/vip" variant="vip">
        See plans
      </ButtonLink>
    </section>
  );
}
