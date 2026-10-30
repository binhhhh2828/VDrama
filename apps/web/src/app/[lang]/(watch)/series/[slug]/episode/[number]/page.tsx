import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionHeader } from "@/components/home/SectionHeader";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SeriesViewerProvider } from "@/components/series/SeriesViewer";
import { PosterRow } from "@/components/series/PosterRow";
import { PosterRowSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { EpisodeReviews } from "@/components/watch/EpisodeReviews";
import { WatchView } from "@/components/watch/WatchView";
import { getSeries, listEpisodes, listSeries } from "@/lib/api/catalog";
import { getServerT } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/paths";
import { LOCALES } from "@/lib/i18n/config";
import type { T } from "@/lib/i18n/translate";
import { IS_DEMO } from "@/lib/demo/config";

type Props = PageProps<"/[lang]/series/[slug]/episode/[number]">;

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
  const { t, locale } = getServerT((await params).lang);
  if (!data) return { title: t("episodes.notFound") };
  const { series, episode } = data;
  const title = t("episodes.metaTitle", { title: series.title, n: episode.number });
  const path = `/series/${series.slug}/episode/${episode.number}`;
  return {
    title,
    description: series.description ?? undefined,
    alternates: {
      canonical: localePath(locale, path),
      languages: Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])),
    },
    openGraph: {
      type: "video.episode",
      title,
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
  const { t } = getServerT((await params).lang);
  const { series, episodes, episode } = data;
  // Số thích và bài đánh giá chỉ có ở dữ liệu demo (API thật chưa có); nạp động để bản thật không kéo
  // dữ liệu mẫu vào.
  const extras = IS_DEMO ? (await import("@/lib/demo/extras")).demoExtras(series.slug) : null;
  return (
    <>
      <div className="px-[13px]">
        <Breadcrumb
          items={[
            { label: t("nav.home"), href: "/" },
            { label: t("nav.browse"), href: "/browse" },
            { label: series.title.toLowerCase() },
          ]}
        />
      </div>
      <SeriesViewerProvider slug={series.slug} seriesId={series.id}>
        <WatchView
          series={{
            id: series.id,
            slug: series.slug,
            title: series.title,
            genres: series.genres,
            description: series.description,
            favoriteCount: series.favorite_count,
          }}
          episodes={episodes}
          episode={episode}
          likes={extras?.likes ?? null}
        >
          <div className="flex flex-col gap-8 px-4">
            <Suspense fallback={<RowFallback />}>
              <RecommendedRow excludeSlug={series.slug} t={t} />
            </Suspense>
            <Suspense fallback={<RowFallback />}>
              <LatestRow excludeSlug={series.slug} t={t} />
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

async function RecommendedRow({ excludeSlug, t }: { excludeSlug: string; t: T }) {
  const { items } = await listSeries({ sort: "hot", limit: 8 });
  const list = items.filter((s) => s.slug !== excludeSlug).slice(0, 6);
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="rec-h" className="flex flex-col gap-4">
      <SectionHeader id="rec-h" title={t("watch.recommended")} size="sm" />
      <PosterRow series={list} />
    </section>
  );
}

async function LatestRow({ excludeSlug, t }: { excludeSlug: string; t: T }) {
  const { items } = await listSeries({ sort: "new", limit: 8 });
  const list = items.filter((s) => s.slug !== excludeSlug).slice(0, 6);
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="latest-h" className="flex flex-col gap-4">
      <SectionHeader id="latest-h" title={t("watch.latest")} size="sm" />
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
