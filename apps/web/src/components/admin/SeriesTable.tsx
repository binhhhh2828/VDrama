"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { SeriesCard } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { AdminHeader, Panel, StatusPill, TableWrap, td, th } from "./ui";

/**
 * Danh sách phim (dữ liệu thật từ catalog). Catalog chỉ trả phim đã xuất bản; phim nháp mở được
 * bằng slug (admin xem trước được), danh sách đầy đủ cần API admin ở Giai đoạn 4.
 */
export function SeriesTable() {
  const router = useRouter();
  const [items, setItems] = useState<SeriesCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const all: SeriesCard[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 20; i++) {
        const page = await api.listSeries({ limit: 50, cursor });
        all.push(...page.items);
        if (!page.next_cursor) break;
        cursor = page.next_cursor;
      }
      if (active) setItems(all);
    })().catch((err) => {
      if (!active) return;
      setItems([]);
      setError(err instanceof ApiError ? err.userMessage : "Couldn't load series.");
    });
    return () => {
      active = false;
    };
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (items ?? []).filter((s) => !term || s.title.toLowerCase().includes(term));
  }, [items, q]);

  return (
    <>
      <AdminHeader
        title="Series & episodes"
        text="Published series from the live catalog. Open one to manage its episodes and videos."
        actions={
          <ButtonLink href="/admin/series/new" size="sm">
            <PlusIcon size={16} /> New series
          </ButtonLink>
        }
      />
      <div className="flex flex-col gap-5">
        <Panel>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex h-11 items-center gap-2.5 rounded-full border border-line bg-canvas px-4 focus-within:border-link md:w-80">
              <SearchIcon size={16} className="text-muted" />
              <span className="sr-only">Filter by title</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter by title"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
              />
            </label>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const s = slug.trim();
                if (s) router.push(`/admin/series/${encodeURIComponent(s)}`);
              }}
            >
              <label htmlFor="open-slug" className="text-sm whitespace-nowrap text-muted">
                Open draft by slug
              </label>
              <input
                id="open-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="the-one-in-my-dream"
                className="h-11 min-w-0 flex-1 rounded-input border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint focus:border-link md:w-48 md:flex-none"
              />
              <button
                type="submit"
                className="h-11 rounded-full border border-line px-4 text-sm font-semibold hover:bg-fg/8"
              >
                Open
              </button>
            </form>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-error-soft">
              {error}
            </p>
          ) : null}

          {items === null ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th className={th}>Series</th>
                  <th className={th}>Genres</th>
                  <th className={th}>Status</th>
                  <th className={th}>Published</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td className={td}>
                      <Link
                        href={`/admin/series/${s.slug}`}
                        className="flex items-center gap-3 text-fg no-underline hover:text-fg"
                      >
                        <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-md bg-art">
                          {s.poster_url ? (
                            <Image
                              src={s.poster_url}
                              alt=""
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          ) : null}
                        </span>
                        <span className="flex flex-col">
                          <span className="font-semibold">{s.title}</span>
                          <span className="font-mono text-xs text-muted">{s.slug}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={`${td} text-fg-soft`}>
                      {s.genres.map((g) => g.name).join(", ")}
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill tone="green">Published</StatusPill>
                        <StatusPill tone="gray">
                          {s.status === "completed" ? "Completed" : "Ongoing"}
                        </StatusPill>
                      </div>
                    </td>
                    <td className={`${td} text-fg-soft`}>{formatDate(s.published_at)}</td>
                    <td className={`${td} text-right`}>
                      <Link href={`/admin/series/${s.slug}`} className="text-sm font-semibold">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`${td} py-8 text-center text-muted`}>
                      No series match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </TableWrap>
          )}
          <p className="text-xs text-muted">
            Drafts and removed series aren&apos;t listed yet: the full admin list needs the admin
            API (Phase 4). Open a draft by its slug above.
          </p>
        </Panel>
      </div>
    </>
  );
}
