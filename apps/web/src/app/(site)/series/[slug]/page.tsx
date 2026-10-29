import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EpisodeList } from "@/components/series/EpisodeList";
import { PosterGrid } from "@/components/series/PosterGrid";
import { SeriesActions } from "@/components/series/SeriesActions";
import { SeriesViewerProvider } from "@/components/series/SeriesViewer";
import { Badge } from "@/components/ui/Badge";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { PosterGridSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { getSeries, listEpisodes, listSeries } from "@/lib/api/catalog";
import type { Episode, SeriesDetail } from "@/lib/api/types";
import { compactNumber } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/series/[slug]">): Promise<Metadata> {
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

export default function SeriesPage({ params }: PageProps<"/series/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-8 px-4 pt-4 pb-16 sm:px-6 md:gap-10 md:pt-6">
      <Link
        href="/browse"
        className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-medium text-muted no-underline hover:text-fg"
      >
        <ChevronLeftIcon size={16} /> Browse
      </Link>
      <Suspense fallback={<SeriesSkeleton />}>
        <SeriesContent params={params} />
      </Suspense>
    </main>
  );
}

async function SeriesContent({ params }: { params: PageProps<"/series/[slug]">["params"] }) {
  const { slug } = await params;
  const [series, episodes] = await Promise.all([getSeries(slug), listEpisodes(slug)]);
  if (!series || !episodes) notFound();

  return (
    <SeriesViewerProvider slug={series.slug} seriesId={series.id}>
      <section className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
        <div className="relative mx-auto aspect-[2/3] w-1/2 max-w-52 shrink-0 overflow-hidden rounded-[18px] border border-line bg-art md:mx-0 md:w-[300px] md:max-w-none">
          {series.poster_url ? (
            <Image
              src={series.poster_url}
              alt={`${series.title} poster`}
              fill
              preload
              sizes="(min-width: 768px) 300px, 200px"
              className="object-cover"
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Badge kind="original" className="self-start" />
          <h1 className="text-[40px] leading-[1.05] font-black tracking-[-0.02em] md:text-[60px]">
            {series.title}
          </h1>
          <DetailChips series={series} />
          {series.description ? (
            <p className="max-w-[720px] text-base leading-relaxed text-fg-soft md:text-lg">
              {series.description}
            </p>
          ) : null}
          <SeriesActions
            slug={series.slug}
            seriesId={series.id}
            title={series.title}
            episodes={episodes}
          />
          <p className="text-sm text-muted">{accessSummary(episodes)}</p>
        </div>
      </section>

      <section aria-labelledby="eps-h" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="eps-h" className="text-xl font-extrabold md:text-2xl">
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

      <Suspense fallback={<PosterGridSkeleton count={6} />}>
        <Related series={series} />
      </Suspense>
    </SeriesViewerProvider>
  );
}

function DetailChips({ series }: { series: SeriesDetail }) {
  const chips = [
    series.year ? String(series.year) : null,
    series.episode_count ? `${series.episode_count} episodes` : null,
    series.status === "completed" ? "Completed" : "Ongoing",
    ...series.genres.map((g) => g.name),
    series.view_count ? `${compactNumber(series.view_count)} views` : null,
  ].filter((c): c is string => Boolean(c));
  return (
    <ul aria-label="Details" className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <li key={c} className="rounded-full border border-line px-3 py-1.5 text-sm text-fg-soft">
          {c}
        </li>
      ))}
    </ul>
  );
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
      <h2 id="like-h" className="text-xl font-extrabold md:text-2xl">
        You may also like
      </h2>
      <PosterGrid series={others} />
    </section>
  );
}

function SeriesSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        <Skeleton className="mx-auto aspect-[2/3] w-1/2 max-w-52 md:mx-0 md:w-[300px] md:max-w-none" />
        <div className="flex flex-1 flex-col gap-5">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-14 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-20 w-full max-w-[720px]" />
          <Skeleton className="h-12 w-full max-w-72 rounded-full" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[92px]" />
        ))}
      </div>
    </div>
  );
}
