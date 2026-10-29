import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionHeader } from "@/components/home/SectionHeader";
import { SeriesViewerProvider } from "@/components/series/SeriesViewer";
import { PosterRow } from "@/components/series/PosterRow";
import { PosterRowSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { EpisodeReviews } from "@/components/watch/EpisodeReviews";
import { WatchView } from "@/components/watch/WatchView";
import { getSeries, listEpisodes, listSeries } from "@/lib/api/catalog";
import { copy } from "@/lib/copy";
import { IS_DEMO } from "@/lib/demo/config";

type Props = PageProps<"/series/[slug]/episode/[number]">;

async function load(params: Props["params"]) {
  const { slug, number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) return null;
  const [series, episodes] = await Promise.all([getSeries(slug), listEpisodes(slug)]);
  const episode = episodes?.find((e) => e.number === n);
  if (!series || !episodes || !episode) return null;
  return { series, episodes, episode };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Episode not found" };
  const { series, episode } = data;
  return {
    title: `${series.title} · Episode ${episode.number}`,
    description: series.description ?? undefined,
    alternates: { canonical: `/series/${series.slug}/episode/${episode.number}` },
    openGraph: {
      type: "video.episode",
      title: `${series.title} · Episode ${episode.number}`,
      images: episode.thumbnail_url ? [{ url: episode.thumbnail_url }] : undefined,
    },
  };
}

export default function WatchPage({ params }: Props) {
  return (
    <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 pb-12">
      <Suspense fallback={<WatchSkeleton />}>
        <WatchContent params={params} />
      </Suspense>
    </main>
  );
}

async function WatchContent({ params }: { params: Props["params"] }) {
  const data = await load(params);
  if (!data) notFound();
  const { series, episodes, episode } = data;
  // Số thích và bài đánh giá chỉ có ở dữ liệu demo (API thật chưa có); nạp động để bản thật không kéo
  // dữ liệu mẫu vào.
  const extras = IS_DEMO ? (await import("@/lib/demo/extras")).demoExtras(series.slug) : null;
  return (
    <>
      <nav aria-label="Breadcrumb" className="px-[13px] pt-3 pb-3.5 text-[15px] text-muted">
        <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <li>
            <Link href="/" className="text-muted no-underline hover:text-fg">
              Home
            </Link>
          </li>
          <li aria-hidden>&gt;</li>
          <li>
            <Link href="/browse" className="text-muted no-underline hover:text-fg">
              {copy.nav.browse}
            </Link>
          </li>
          <li aria-hidden>&gt;</li>
          <li aria-current="page" className="basis-full text-fg">
            {series.title.toLowerCase()}
          </li>
        </ol>
      </nav>
      <SeriesViewerProvider slug={series.slug} seriesId={series.id}>
        <WatchView
          series={{
            id: series.id,
            slug: series.slug,
            title: series.title,
            genres: series.genres.map((g) => g.name),
            description: series.description,
            favoriteCount: series.favorite_count,
          }}
          episodes={episodes}
          episode={episode}
          likes={extras?.likes ?? null}
        >
          <div className="flex flex-col gap-8 px-4">
            <Suspense fallback={<RowFallback />}>
              <RecommendedRow excludeSlug={series.slug} />
            </Suspense>
            <Suspense fallback={<RowFallback />}>
              <LatestRow excludeSlug={series.slug} />
            </Suspense>
          </div>
          {extras ? (
            <EpisodeReviews reviews={extras.reviews} seriesHref={`/series/${series.slug}`} />
          ) : null}
        </WatchView>
      </SeriesViewerProvider>
    </>
  );
}

function RowFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="ml-1.5 h-5 w-40 rounded-md" />
      <PosterRowSkeleton />
    </div>
  );
}

async function RecommendedRow({ excludeSlug }: { excludeSlug: string }) {
  const { items } = await listSeries({ sort: "hot", limit: 8 });
  const list = items.filter((s) => s.slug !== excludeSlug).slice(0, 6);
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="rec-h" className="flex flex-col gap-4">
      <SectionHeader id="rec-h" title={copy.watch.recommended} size="sm" />
      <PosterRow series={list} />
    </section>
  );
}

async function LatestRow({ excludeSlug }: { excludeSlug: string }) {
  const { items } = await listSeries({ sort: "new", limit: 8 });
  const list = items.filter((s) => s.slug !== excludeSlug).slice(0, 6);
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="latest-h" className="flex flex-col gap-4">
      <SectionHeader id="latest-h" title={copy.watch.latest} size="sm" />
      <PosterRow series={list} />
    </section>
  );
}

function WatchSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="mx-[13px] mb-3.5 h-5 w-56 rounded-md" />
      <div className="flex justify-center bg-canvas-black">
        <Skeleton className="aspect-[9/16] w-[min(73.3vw,340px)] rounded-none" />
      </div>
      <Skeleton className="mt-2 h-72 rounded-b-none rounded-t-[24px]" />
    </div>
  );
}
