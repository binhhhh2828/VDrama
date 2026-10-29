import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SeriesList } from "@/components/series/SeriesList";
import { Chip } from "@/components/ui/Chip";
import { PosterGridSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { listGenres, listSeries } from "@/lib/api/catalog";
import type { SeriesSort } from "@/lib/api/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Browse series",
  description: "Browse every VDrama series by genre, newest or trending.",
};

const PAGE_SIZE = 18;

type Filters = { genre: string | null; sort: SeriesSort };

function readFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const genre = typeof sp.genre === "string" && sp.genre ? sp.genre : null;
  const sort: SeriesSort = sp.sort === "hot" ? "hot" : "new";
  return { genre, sort };
}

function href(f: Filters): string {
  const qs = new URLSearchParams();
  if (f.genre) qs.set("genre", f.genre);
  if (f.sort !== "new") qs.set("sort", f.sort);
  const s = qs.toString();
  return s ? `/browse?${s}` : "/browse";
}

// /browse?genre=&sort=new|hot. Bộ lọc nằm trong URL nên chia sẻ được và nút Back hoạt động.
export default function BrowsePage({ searchParams }: PageProps<"/browse">) {
  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 md:gap-8 md:pt-10">
      <h1 className="text-[28px] font-extrabold tracking-[-0.01em] md:text-[36px]">Browse</h1>
      <Suspense fallback={<FiltersSkeleton />}>
        <BrowseContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BrowseContent({
  searchParams,
}: {
  searchParams: PageProps<"/browse">["searchParams"];
}) {
  const filters = readFilters(await searchParams);
  const genres = await listGenres();
  const current = genres.find((g) => g.slug === filters.genre);

  return (
    <>
      <div className="flex flex-col gap-4">
        <nav
          aria-label="Genres"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 md:gap-2.5"
        >
          <Chip
            href={href({ ...filters, genre: null })}
            active={!filters.genre}
            className="shrink-0"
          >
            All
          </Chip>
          {genres.map((g) => (
            <Chip
              key={g.slug}
              href={href({ ...filters, genre: g.slug })}
              active={filters.genre === g.slug}
              className="shrink-0"
            >
              {g.name}
            </Chip>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted" aria-live="polite">
            {current ? current.name : "All genres"} ·{" "}
            {filters.sort === "hot" ? "Most watched" : "Newest first"}
          </p>
          <SortToggle filters={filters} />
        </div>
      </div>

      <Suspense key={href(filters)} fallback={<PosterGridSkeleton count={12} />}>
        <Results filters={filters} unknownGenre={filters.genre !== null && !current} />
      </Suspense>
    </>
  );
}

function SortToggle({ filters }: { filters: Filters }) {
  const options: Array<[SeriesSort, string]> = [
    ["new", "Newest"],
    ["hot", "Trending"],
  ];
  return (
    <div
      role="group"
      aria-label="Sort"
      className="flex rounded-full border border-line bg-surface p-1"
    >
      {options.map(([value, label]) => {
        const active = filters.sort === value;
        return (
          <Link
            key={value}
            href={href({ ...filters, sort: value })}
            aria-current={active ? "true" : undefined}
            className={cn(
              "flex min-h-10 items-center rounded-full px-4 text-sm font-semibold no-underline",
              active ? "bg-surface-2 text-fg hover:text-fg" : "text-muted hover:text-fg",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

async function Results({ filters, unknownGenre }: { filters: Filters; unknownGenre: boolean }) {
  const params = { sort: filters.sort, genre: filters.genre ?? undefined };
  const page = unknownGenre
    ? { items: [], next_cursor: null }
    : await listSeries({ ...params, limit: PAGE_SIZE });

  if (page.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-16 text-center">
        <p className="text-lg font-bold">No series here yet</p>
        <p className="text-muted">New dramas land every week. Try another genre for now.</p>
        <Link href="/browse" className="font-semibold">
          See all series
        </Link>
      </div>
    );
  }
  return <SeriesList initial={page} params={params} pageSize={PAGE_SIZE} />;
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-11 w-full max-w-2xl rounded-full" />
      <PosterGridSkeleton count={12} />
    </div>
  );
}
