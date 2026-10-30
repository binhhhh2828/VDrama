import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionHeader } from "@/components/home/SectionHeader";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { EpisodeList } from "@/components/series/EpisodeList";
import { PosterRow } from "@/components/series/PosterRow";
import { MyListButton, ShareButton, WatchNowButton } from "@/components/series/SeriesActions";
import { SeriesViewerProvider } from "@/components/series/SeriesViewer";
import { GenreTag } from "@/components/ui/Chip";
import { PosterArt } from "@/components/ui/PosterArt";
import { PosterRowSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { getSeries, listEpisodes, listSeries } from "@/lib/api/catalog";
import type { Episode, SeriesDetail } from "@/lib/api/types";
import { copy } from "@/lib/copy";
import { compactNumber } from "@/lib/format";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/series/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeries(slug);
  if (!series) return { title: "Series not found" };
  const description =
    series.description ?? `Watch ${series.title} on VDrama. ${series.genres[0]?.name ?? ""}`.trim();
  const image = series.banner_url ?? series.poster_url;
  return {
    title: series.title,
    description,
    alternates: { canonical: `/series/${series.slug}` },
    openGraph: {
      type: "video.tv_show",
      title: series.title,
      description,
      url: `/series/${series.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: "summary_large_image", title: series.title, description },
  };
}

// Trang giới thiệu phim theo ảnh 15: khung tím mận bo lớn (tên, số tập, nút "Watch now", poster),
// rồi mô tả, danh sách tập và hàng phim tương tự.
export default function SeriesPage({ params }: PageProps<"/[lang]/series/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col px-4 pb-16 sm:px-6">
      <Suspense fallback={<SeriesSkeleton />}>
        <SeriesContent params={params} />
      </Suspense>
    </main>
  );
}

async function SeriesContent({ params }: { params: PageProps<"/[lang]/series/[slug]">["params"] }) {
  const { slug } = await params;
  const [series, episodes] = await Promise.all([getSeries(slug), listEpisodes(slug)]);
  if (!series || !episodes) notFound();

  return (
    <SeriesViewerProvider slug={series.slug} seriesId={series.id}>
      <Breadcrumb
        items={[
          { label: copy.nav.home, href: "/" },
          { label: copy.nav.browse, href: "/browse" },
          { label: series.title.toLowerCase() },
        ]}
      />

      <section
        aria-labelledby="series-h"
        className="mt-5 flex flex-col gap-7 rounded-[36px] bg-plum-3 px-5 py-8 md:flex-row-reverse md:items-center md:gap-12 md:px-12 md:py-12"
      >
        <div className="flex flex-col items-center gap-4 text-center md:flex-1 md:items-start md:text-left">
          <h1
            id="series-h"
            className="text-lg leading-7 font-medium md:text-[40px] md:leading-tight md:font-bold"
          >
            {series.title}
          </h1>
          <p className="text-base text-fg-soft">{statusLine(series)}</p>
          {series.genres.length > 0 ? (
            <ul
              aria-label="Genres"
              className="flex flex-wrap justify-center gap-2 md:justify-start"
            >
              {series.genres.map((g) => (
                <li key={g.slug}>
                  <GenreTag className="bg-fg/12 px-3.5 py-1.5 text-[13px]">{g.name}</GenreTag>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <WatchNowButton slug={series.slug} episodes={episodes} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <MyListButton seriesId={series.id} />
            <ShareButton title={series.title} />
          </div>
        </div>

        <PosterArt
          src={series.poster_detail_url ?? series.poster_url}
          title={series.title}
          preload
          sizes="(min-width: 768px) 300px, 260px"
          className="mx-auto w-[64%] max-w-[260px] rounded-[20px] shadow-2xl shadow-black/50 md:mx-0 md:w-[300px] md:max-w-none"
        />
      </section>

      <div className="mt-8 flex flex-col gap-8">
        {series.description ? (
          <section aria-labelledby="about-h" className="flex flex-col gap-2 px-1">
            <h2 id="about-h" className="text-base font-bold">
              {copy.series.summary}
            </h2>
            <p className="max-w-[720px] text-[15px] leading-7 text-fg-soft">{series.description}</p>
            <p className="text-sm text-muted">
              {[
                series.year ? String(series.year) : null,
                series.view_count ? `${compactNumber(series.view_count)} views` : null,
                accessSummary(episodes),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </section>
        ) : null}

        <section aria-labelledby="eps-h" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3 px-1">
            <h2 id="eps-h" className="text-xl font-semibold md:text-2xl">
              Episodes
            </h2>
            <span className="text-sm text-muted">{episodeCountLabel(series)}</span>
          </div>
          {episodes.length ? (
            <EpisodeList slug={series.slug} episodes={episodes} />
          ) : (
            <p className="rounded-card border border-line bg-surface p-6 text-muted">
              The first episode is on its way. Add this series to My List to find it later.
            </p>
          )}
        </section>

        <Suspense fallback={<PosterRowSkeleton />}>
          <Related series={series} />
        </Suspense>
      </div>
    </SeriesViewerProvider>
  );
}

/** "35 episodes, Fully updated" như ảnh 15. */
function statusLine(series: SeriesDetail): string {
  const count = series.episode_count || series.total_episodes || 0;
  const episodes = count ? `${count} episodes` : "Episodes coming soon";
  return `${episodes}, ${series.status === "completed" ? "Fully updated" : "New episodes weekly"}`;
}

/** "Episodes 1–2 are free. VIP unlocks episodes 3–12." */
function accessSummary(episodes: Episode[]): string {
  const free = episodes.filter((e) => e.access === "free").map((e) => e.number);
  const vip = episodes.filter((e) => e.access === "vip").map((e) => e.number);
  const range = (ns: number[]) =>
    ns.length === 1 ? `episode ${ns[0]}` : `episodes ${ns[0]}–${ns[ns.length - 1]}`;
  if (!episodes.length) return "";
  if (!vip.length) return "Every episode is free with an account.";
  if (!free.length) return "Every episode is for VIP members.";
  const freeText = range(free);
  return `${freeText[0].toUpperCase()}${freeText.slice(1)} ${free.length === 1 ? "is" : "are"} free. VIP unlocks ${range(vip)}.`;
}

function episodeCountLabel(series: SeriesDetail): string {
  const have = series.episode_count;
  if (series.status === "completed" || !series.total_episodes) return `${have} episodes`;
  return `${have} of ${series.total_episodes} · new episodes weekly`;
}

async function Related({ series }: { series: SeriesDetail }) {
  const genre = series.genres[0]?.slug;
  const { items } = await listSeries({ genre, sort: "hot", limit: 8 });
  const others = items.filter((s) => s.id !== series.id).slice(0, 6);
  if (others.length === 0) return null;
  return (
    <section aria-labelledby="like-h" className="flex flex-col gap-4">
      <SectionHeader id="like-h" title={copy.home.forYou} size="sm" />
      <PosterRow series={others} />
    </section>
  );
}

function SeriesSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="mt-6 h-5 w-48 rounded-md" />
      <Skeleton className="h-[560px] rounded-[36px]" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[92px]" />
        ))}
      </div>
    </div>
  );
}
