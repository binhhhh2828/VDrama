import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchResultList, SearchResultSkeleton } from "@/components/series/SearchResultList";
import { Chip } from "@/components/ui/Chip";
import { getSeries, listGenres, searchSeries } from "@/lib/api/catalog";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false }, // trang kết quả tìm kiếm không cần lên Google
};

const MIN_LENGTH = 2;
const MAX_RESULTS = 20;

// /search?q= theo ảnh 22. Ô tìm kiếm nằm ở header (giữ từ khóa đang tìm); tìm khi gửi form (Enter),
// không tìm theo từng phím gõ. Từ khóa dưới 2 ký tự thì không gọi API.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-6">
      <h1 className="sr-only">Search results</h1>
      <Suspense fallback={<SearchResultSkeleton />}>
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

  if (q.length >= MIN_LENGTH) {
    return (
      <Suspense key={q} fallback={<SearchResultSkeleton />}>
        <Results q={q} />
      </Suspense>
    );
  }
  return (
    <>
      <p className="text-muted" aria-live="polite">
        {q.length > 0
          ? `Type at least ${MIN_LENGTH} characters to search.`
          : "Search by series title using the box above."}
      </p>
      <Suspense fallback={null}>
        <GenreSuggestions />
      </Suspense>
    </>
  );
}

async function Results({ q }: { q: string }) {
  const found = await searchSeries(q, MAX_RESULTS);
  if (found.length === 0) {
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
  // Kết quả tìm kiếm của API không có mô tả; lấy từ trang chi tiết (đã cache vài phút).
  const details = await Promise.all(found.map((s) => getSeries(s.slug)));
  const descriptions = Object.fromEntries(
    found.map((s, i) => [s.slug, details[i]?.description ?? null]),
  );
  return (
    <section aria-label={`${found.length} results for ${q}`}>
      <SearchResultList items={found} descriptions={descriptions} q={q} />
    </section>
  );
}

async function GenreSuggestions() {
  const genres = await listGenres();
  if (genres.length === 0) return null;
  return (
    <section aria-labelledby="explore-h" className="flex flex-col gap-3">
      <h2 id="explore-h" className="text-lg font-semibold">
        Or explore a genre
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {genres.map((g) => (
          <Chip key={g.slug} href={`/browse?genre=${g.slug}`}>
            {g.name}
          </Chip>
        ))}
      </div>
    </section>
  );
}
