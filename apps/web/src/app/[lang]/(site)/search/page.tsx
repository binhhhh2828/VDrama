import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchResultList, SearchResultSkeleton } from "@/components/series/SearchResultList";
import { Chip } from "@/components/ui/Chip";
import { getSeries, listGenres, searchSeries } from "@/lib/api/catalog";
import { Link } from "@/components/i18n/navigation";
import { GenreName } from "@/components/i18n/GenreName";
import { getServerT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/translate";

export async function generateMetadata({ params }: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { t } = getServerT((await params).lang);
  // Trang kết quả tìm kiếm không cần lên Google.
  return { title: t("search.metaTitle"), robots: { index: false } };
}

const MIN_LENGTH = 2;
const MAX_RESULTS = 20;

// /search?q= theo ảnh 22. Ô tìm kiếm nằm ở header (giữ từ khóa đang tìm); tìm khi gửi form (Enter),
// không tìm theo từng phím gõ. Từ khóa dưới 2 ký tự thì không gọi API.
export default async function SearchPage({ params, searchParams }: PageProps<"/[lang]/search">) {
  const { t } = getServerT((await params).lang);
  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-6">
      <h1 className="sr-only">{t("search.heading")}</h1>
      <Suspense fallback={<SearchResultSkeleton />}>
        <SearchContent searchParams={searchParams} t={t} />
      </Suspense>
    </main>
  );
}

async function SearchContent({
  searchParams,
  t,
}: {
  searchParams: PageProps<"/[lang]/search">["searchParams"];
  t: T;
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);

  if (q.length >= MIN_LENGTH) {
    return (
      <Suspense key={q} fallback={<SearchResultSkeleton />}>
        <Results q={q} t={t} />
      </Suspense>
    );
  }
  return (
    <>
      <p className="text-muted" aria-live="polite">
        {q.length > 0 ? t("search.minChars", { n: MIN_LENGTH }) : t("search.hint")}
      </p>
      <Suspense fallback={null}>
        <GenreSuggestions t={t} />
      </Suspense>
    </>
  );
}

async function Results({ q, t }: { q: string; t: T }) {
  const found = await searchSeries(q, MAX_RESULTS);
  if (found.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-16 text-center">
        <p className="text-lg font-bold">{t("search.noMatchTitle", { q })}</p>
        <p className="text-muted">{t("search.noMatchText")}</p>
        <Link href="/browse" className="font-semibold">
          {t("search.browseAll")}
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
    <section aria-label={t("search.results", { n: found.length, q })}>
      <SearchResultList items={found} descriptions={descriptions} q={q} />
    </section>
  );
}

async function GenreSuggestions({ t }: { t: T }) {
  const genres = await listGenres();
  if (genres.length === 0) return null;
  return (
    <section aria-labelledby="explore-h" className="flex flex-col gap-3">
      <h2 id="explore-h" className="text-lg font-semibold">
        {t("search.explore")}
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {genres.map((g) => (
          <Chip key={g.slug} href={`/browse?genre=${g.slug}`}>
            <GenreName genre={g} />
          </Chip>
        ))}
      </div>
    </section>
  );
}
