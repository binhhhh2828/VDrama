"use client";

import { useEffect, useState } from "react";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import type { Genre, SeriesDetail } from "@/lib/api/types";
import { ReasonAction } from "./kit";
import { Panel } from "./ui";

const input =
  "h-11 w-full rounded-input border border-line bg-canvas px-3 text-[15px] text-fg outline-none placeholder:text-faint focus:border-link";

/**
 * PREVIEW form tạo / sửa phim. Chưa có API admin (Giai đoạn 4): không có <form>, nút lưu bị tắt,
 * không gửi dữ liệu đi đâu. Trường khớp cột bảng `series`.
 */
export function SeriesForm({ series }: { series?: SeriesDetail }) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [title, setTitle] = useState(series?.title ?? "");
  const slugFromTitle = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  useEffect(() => {
    let active = true;
    api
      .request<Genre[]>("GET", "/genres")
      .then((g) => active && setGenres(g))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const selected = new Set(series?.genres.map((g) => g.slug) ?? []);

  return (
    <div className="flex flex-col gap-5">
      <PreviewNotice>
        Saving isn&apos;t connected yet: creating and editing series needs the admin API (Phase 4).
        This form shows the fields that will be available.
      </PreviewNotice>
      <Panel title={series ? "Series details" : "New series"}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Title
            <input
              className={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Virtual City"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            URL slug
            <input
              className={`${input} font-mono text-sm`}
              value={series?.slug ?? slugFromTitle}
              readOnly
            />
            <span className="text-xs font-normal text-muted">
              vdrama.com/series/{series?.slug ?? (slugFromTitle || "…")}
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold md:col-span-2">
            Description
            <textarea
              className={`${input} h-24 py-2.5`}
              defaultValue={series?.description ?? ""}
              placeholder="One or two lines that sell the story."
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Status
            <select className={input} defaultValue={series?.status ?? "ongoing"}>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Planned episodes
            <input
              className={input}
              type="number"
              min={1}
              defaultValue={series?.total_episodes ?? ""}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Year
            <input
              className={input}
              type="number"
              defaultValue={series?.year ?? ""}
              placeholder="2026"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Country
            <input className={input} defaultValue={series?.country ?? ""} placeholder="Vietnam" />
          </label>
          <fieldset className="flex flex-col gap-2 md:col-span-2">
            <legend className="mb-1.5 text-sm font-semibold">Genres</legend>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <label
                  key={g.slug}
                  className="flex min-h-10 items-center gap-2 rounded-full border border-line px-3.5 text-sm"
                >
                  <input
                    type="checkbox"
                    defaultChecked={selected.has(g.slug)}
                    className="accent-pink"
                  />
                  {g.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5 text-sm font-semibold">
            Poster (2:3)
            <div className="flex h-24 items-center justify-center rounded-input border border-dashed border-line text-xs font-normal text-muted">
              Image upload to Cloudflare R2 · Phase 4
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-sm font-semibold">
            Banner (wide, optional)
            <div className="flex h-24 items-center justify-center rounded-input border border-dashed border-line text-xs font-normal text-muted">
              Shown in the home page carousel
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button disabled size="sm">
            {series ? "Save changes" : "Create series"}
          </Button>
          <label className="flex items-center gap-2 text-sm text-fg-soft">
            <input
              type="checkbox"
              defaultChecked={series?.is_published ?? false}
              className="size-4 accent-pink"
            />
            Published (needs a published-at date; episodes need a ready video)
          </label>
        </div>
      </Panel>
    </div>
  );
}

/** PREVIEW vùng nguy hiểm: xóa (xóa mềm, khôi phục được) bắt buộc có lý do, giống audit_logs. */
export function DangerZone({ what }: { what: string }) {
  return (
    <ReasonAction
      danger
      title="Remove"
      variant="danger"
      actionLabel={`Remove ${what}`}
      placeholder="e.g. Rights expired"
      text={`Removing hides the ${what} everywhere on the site. It stays in the database and can be restored.`}
    />
  );
}
