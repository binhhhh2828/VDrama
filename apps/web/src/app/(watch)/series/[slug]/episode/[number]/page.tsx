import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { SeriesViewerProvider } from "@/components/series/SeriesViewer";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { WatchView } from "@/components/watch/WatchView";
import { getSeries, listEpisodes } from "@/lib/api/catalog";

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
    <>
      <Suspense fallback={<WatchHeader />}>
        <HeaderWithTitle params={params} />
      </Suspense>
      <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-0 pb-12 sm:px-6 sm:pt-6">
        <Suspense fallback={<WatchSkeleton />}>
          <WatchContent params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function HeaderWithTitle({ params }: { params: Props["params"] }) {
  const data = await load(params);
  return (
    <WatchHeader series={data ? { slug: data.series.slug, title: data.series.title } : null} />
  );
}

function WatchHeader({ series }: { series?: { slug: string; title: string } | null }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-2.5 sm:px-6">
        <Link
          href={series ? `/series/${series.slug}` : "/"}
          className="inline-flex min-h-11 min-w-0 items-center gap-2 text-[15px] font-semibold text-fg no-underline hover:text-fg"
        >
          <ChevronLeftIcon size={18} className="shrink-0" />
          <span className="truncate">{series?.title ?? "Back"}</span>
        </Link>
        <Link href="/" aria-label="VDrama home" className="ml-auto shrink-0 leading-none">
          <Logo height={36} className="h-8 w-auto sm:h-9" />
        </Link>
      </div>
    </header>
  );
}

async function WatchContent({ params }: { params: Props["params"] }) {
  const data = await load(params);
  if (!data) notFound();
  const { series, episodes, episode } = data;
  return (
    <SeriesViewerProvider slug={series.slug} seriesId={series.id}>
      <WatchView
        series={{ id: series.id, slug: series.slug, title: series.title }}
        episodes={episodes}
        episode={episode}
      />
    </SeriesViewerProvider>
  );
}

function WatchSkeleton() {
  return (
    <div className="flex flex-col gap-7 lg:flex-row">
      <div className="flex flex-1 flex-col gap-5">
        <Skeleton className="aspect-video rounded-none sm:rounded-[18px]" />
        <Skeleton className="mx-4 h-8 w-2/3 sm:mx-0" />
      </div>
      <Skeleton className="mx-4 h-[420px] sm:mx-0 lg:w-[360px]" />
    </div>
  );
}
