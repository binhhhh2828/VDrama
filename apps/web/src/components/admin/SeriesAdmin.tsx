"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Episode, SeriesDetail } from "@/lib/api/types";
import { compactNumber, formatDate, formatDuration } from "@/lib/format";
import { DangerZone, SeriesForm } from "./SeriesForm";
import { AdminHeader, Panel, StatusPill, TableWrap, td, th } from "./ui";

type State =
  | { kind: "loading" }
  | { kind: "ready"; series: SeriesDetail; episodes: Episode[] }
  | { kind: "error"; message: string };

/** Quản lý một phim: dữ liệu thật (admin xem được cả phim/tập chưa xuất bản qua API catalog). */
export function SeriesAdmin({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    const path = `/series/${encodeURIComponent(slug)}`;
    Promise.all([api.request<SeriesDetail>("GET", path), api.adminEpisodes(slug)]).then(
      ([series, episodes]) => active && setState({ kind: "ready", series, episodes }),
      (err) =>
        active &&
        setState({
          kind: "error",
          message:
            err instanceof ApiError && err.code === "not_found"
              ? `No series with the slug “${slug}”.`
              : err instanceof ApiError
                ? err.userMessage
                : "Couldn't load this series.",
        }),
    );
    return () => {
      active = false;
    };
  }, [slug]);

  if (state.kind === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <>
        <AdminHeader title="Series" back={{ href: "/admin/series", label: "All series" }} />
        <Panel>
          <p className="text-fg-soft">{state.message}</p>
        </Panel>
      </>
    );
  }

  const { series, episodes } = state;
  const drafts = episodes.filter((e) => !e.is_published).length;

  return (
    <>
      <AdminHeader
        title={series.title}
        text={<span className="font-mono">/series/{series.slug}</span>}
        back={{ href: "/admin/series", label: "All series" }}
        actions={
          series.is_published ? (
            <ButtonLink href={`/series/${series.slug}`} size="sm" variant="secondary">
              View on site
            </ButtonLink>
          ) : null
        }
      />

      <div className="flex flex-col gap-5">
        <Panel>
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-card border border-line bg-art">
              {series.poster_url ? (
                <Image src={series.poster_url} alt="" fill sizes="112px" className="object-cover" />
              ) : null}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              <Stat label="Visibility">
                {series.is_published ? (
                  <StatusPill tone="green">Published</StatusPill>
                ) : (
                  <StatusPill tone="amber">Draft</StatusPill>
                )}
              </Stat>
              <Stat label="Status">{series.status === "completed" ? "Completed" : "Ongoing"}</Stat>
              <Stat label="Episodes">
                {series.episode_count} published{drafts ? ` · ${drafts} draft` : ""}
                {series.total_episodes ? ` / ${series.total_episodes} planned` : ""}
              </Stat>
              <Stat label="Published">{formatDate(series.published_at) || "–"}</Stat>
              <Stat label="Views">{compactNumber(series.view_count)}</Stat>
              <Stat label="In My Lists">{compactNumber(series.favorite_count)}</Stat>
              <Stat label="Genres">{series.genres.map((g) => g.name).join(", ") || "–"}</Stat>
              <Stat label="Banner">{series.banner_url ? "Yes (home carousel)" : "No"}</Stat>
            </div>
          </div>
        </Panel>

        <Panel
          title={`Episodes (${episodes.length})`}
          actions={
            <span
              className="inline-flex items-center gap-1.5 text-xs text-muted"
              title="Needs the admin API (Phase 4)"
            >
              <PlusIcon size={14} /> Add episode · Preview
            </span>
          }
        >
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>Title</th>
                <th className={th}>Length</th>
                <th className={th}>Access</th>
                <th className={th}>Visibility</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((e) => (
                <tr key={e.id}>
                  <td className={`${td} font-bold text-link`}>{e.number}</td>
                  <td className={td}>{e.title}</td>
                  <td className={`${td} text-fg-soft`}>{formatDuration(e.duration_sec) || "–"}</td>
                  <td className={td}>
                    <StatusPill tone={e.access === "free" ? "green" : "amber"}>
                      {e.access === "free" ? "Free" : "VIP"}
                    </StatusPill>
                  </td>
                  <td className={td}>
                    {e.is_published ? (
                      <StatusPill tone="green">Published</StatusPill>
                    ) : (
                      <StatusPill tone="amber">Draft</StatusPill>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <Link
                      href={`/admin/series/${series.slug}/episodes/${e.number}`}
                      className="text-sm font-semibold"
                    >
                      Video
                    </Link>
                  </td>
                </tr>
              ))}
              {episodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${td} py-8 text-center text-muted`}>
                    No episodes yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </TableWrap>
        </Panel>

        <SeriesForm series={series} />
        <DangerZone what="series" />
      </div>
    </>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-semibold">{children}</span>
    </div>
  );
}
