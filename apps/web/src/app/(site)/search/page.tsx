import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PosterGrid } from "@/components/series/PosterGrid";
import { SearchIcon } from "@/components/ui/icons";
import { PosterGridSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { listGenres, searchSeries } from "@/lib/api/catalog";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false }, // trang kết quả tìm kiếm không cần lên Google
};

const MIN_LENGTH = 2;

// /search?q=. Tìm khi người dùng gửi form (Enter hoặc nút), không tìm theo từng phím gõ.
// Từ khóa dưới 2 ký tự thì không gọi API.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 md:gap-8 md:pt-10">
      <h1 className="text-[28px] font-extrabold tracking-[-0.01em] md:text-[36px]">Search</h1>
      <Suspense fallback={<Skeleton className="h-14 w-full max-w-2xl rounded-full" />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchContent({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);

  return (
    <>
      <form role="search" action="/search" className="flex w-full max-w-2xl gap-2.5">
        <label htmlFor="search-q" className="sr-only">
          Search series
        </label>
        <div className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-full border border-line bg-surface px-5 focus-within:border-link">
          <SearchIcon size={20} className="shrink-0 text-muted" />
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            // Mở trang tìm kiếm (nút kính lúp trên điện thoại) thì gõ được ngay.
            autoFocus={!q}
            minLength={MIN_LENGTH}
            maxLength={100}
            required
            placeholder="Search by series title…"
            className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-faint"
          />
        </div>
        <button
          type="submit"
          className="h-14 shrink-0 rounded-full bg-brand px-5 font-bold sm:px-6 text-ink hover:brightness-110"
        >
          Search
        </button>
      </form>

      {q.length >= MIN_LENGTH ? (
        <Suspense key={q} fallback={<PosterGridSkeleton count={6} />}>
          <Results q={q} />
        </Suspense>
      ) : q.length > 0 ? (
        <p className="text-muted">Type at least {MIN_LENGTH} characters to search.</p>
      ) : (
        <Suspense fallback={null}>
          <GenreSuggestions />
        </Suspense>
      )}
    </>
  );
}

async function Results({ q }: { q: string }) {
  const items = await searchSeries(q, 30);
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-16 text-center">
        <p className="text-lg font-bold">No series match &ldquo;{q}&rdquo;</p>
        <p className="text-muted">Check the spelling, try part of the title, or browse by genre.</p>
        <Link href="/browse" className="font-semibold">
          Browse all series
        </Link>
      </div>
    );
  }
  return (
    <section aria-labelledby="results-h" className="flex flex-col gap-4">
      <h2 id="results-h" className="text-sm text-muted" aria-live="polite">
        {items.length} {items.length === 1 ? "result" : "results"} for &ldquo;{q}&rdquo;
      </h2>
      <PosterGrid series={items} preloadFirst={6} />
    </section>
  );
}

async function GenreSuggestions() {
  const genres = await listGenres();
  if (genres.length === 0) return null;
  return (
    <section aria-labelledby="explore-h" className="flex flex-col gap-3">
      <h2 id="explore-h" className="text-lg font-bold">
        Or explore a genre
      </h2>
      <div className="flex flex-wrap gap-2">
        {genres.map((g) => (
          <Link
            key={g.slug}
            href={`/browse?genre=${g.slug}`}
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-[15px] font-semibold text-fg no-underline hover:border-fg/30 hover:text-fg"
          >
            {g.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
