"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PreviewNotice } from "@/components/preview/PreviewNotice";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Episode, StreamSyncResult } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import { DangerZone } from "./SeriesForm";
import { AdminHeader, Panel, StatusPill } from "./ui";
import { streamTone } from "./tones";

const CHUNK = 50 * 1024 * 1024; // 50 MB mỗi phần (tài liệu Stream: 5–200 MB, bội số 256 KiB)

/** Câu báo lỗi riêng cho thao tác video (theo bảng tình huống trong docs/api.md). */
function videoError(err: unknown, action: "upload" | "sync"): string {
  if (!(err instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (err.code) {
    case "conflict":
      return action === "upload"
        ? "This episode is published. Unpublish it before replacing its video."
        : "This episode doesn't have a video yet. Upload one first.";
    case "stream_unavailable":
      return "The video service (Cloudflare Stream) isn't configured on this server yet, so uploads can't start.";
    case "stream_provider_error":
      return "Cloudflare Stream returned an error or didn't respond. Nothing was changed. Try again in a moment.";
    case "validation_error":
      return "That file is too large or empty.";
    default:
      return err.userMessage;
  }
}

type Upload =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "uploading"; pct: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

/** Quản lý video của một tập: upload thẳng lên Cloudflare (tus) và đồng bộ trạng thái (API thật). */
export function EpisodeAdmin({ slug, number }: { slug: string; number: number }) {
  const [episode, setEpisode] = useState<Episode | null | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<Upload>({ phase: "idle" });
  const [sync, setSync] = useState<
    | { phase: "idle" }
    | { phase: "busy" }
    | { phase: "ok"; data: StreamSyncResult }
    | { phase: "error"; message: string }
  >({ phase: "idle" });
  const tusRef = useRef<{ abort: () => Promise<void> } | null>(null);

  useEffect(() => {
    let active = true;
    api.adminEpisodes(slug).then(
      (eps) => active && setEpisode(eps.find((e) => e.number === number) ?? null),
      () => active && setEpisode(null),
    );
    return () => {
      active = false;
      void tusRef.current?.abort();
    };
  }, [slug, number]);

  async function startUpload() {
    if (!episode || !file) return;
    setUpload({ phase: "starting" });
    try {
      const ticket = await api.adminStartUpload(episode.id, file.size);
      const { Upload: TusUpload } = await import("tus-js-client");
      const tus = new TusUpload(file, {
        uploadUrl: ticket.upload_url, // không đặt endpoint: URL đã do API tạo sẵn
        chunkSize: CHUNK,
        retryDelays: [0, 3000, 10000, 30000],
        metadata: { name: file.name, filetype: file.type },
        onProgress: (sent, total) =>
          setUpload({ phase: "uploading", pct: total ? sent / total : 0 }),
        onSuccess: () => setUpload({ phase: "done" }),
        onError: () =>
          setUpload({
            phase: "error",
            message: "The upload was interrupted. Choose the file again to retry.",
          }),
      });
      tusRef.current = tus;
      setUpload({ phase: "uploading", pct: 0 });
      tus.start();
    } catch (err) {
      setUpload({ phase: "error", message: videoError(err, "upload") });
    }
  }

  async function runSync() {
    if (!episode) return;
    setSync({ phase: "busy" });
    try {
      setSync({ phase: "ok", data: await api.adminStreamSync(episode.id) });
    } catch (err) {
      setSync({ phase: "error", message: videoError(err, "sync") });
    }
  }

  if (episode === undefined) return <Skeleton className="h-80" />;
  const back = { href: `/admin/series/${slug}`, label: "Back to series" };
  if (episode === null) {
    return (
      <>
        <AdminHeader title={`Episode ${number}`} back={back} />
        <Panel>
          <p className="text-fg-soft">This episode doesn&apos;t exist.</p>
        </Panel>
      </>
    );
  }

  const busy = upload.phase === "starting" || upload.phase === "uploading";

  return (
    <>
      <AdminHeader
        title={`Episode ${episode.number} · ${episode.title}`}
        text={`${formatDuration(episode.duration_sec) || "No video length yet"} · ${episode.access === "free" ? "Free" : "VIP"}`}
        back={back}
        actions={
          episode.is_published ? (
            <ButtonLink
              href={`/series/${slug}/episode/${episode.number}`}
              size="sm"
              variant="secondary"
            >
              Watch on site
            </ButtonLink>
          ) : null
        }
      />

      <div className="flex flex-col gap-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel
            title="Upload video"
            actions={
              episode.is_published ? (
                <StatusPill tone="green">Published</StatusPill>
              ) : (
                <StatusPill tone="amber">Draft</StatusPill>
              )
            }
          >
            <p className="text-sm text-fg-soft">
              The file goes straight from your browser to Cloudflare Stream, not through our server.
              Large files resume automatically if the connection drops.
              {episode.is_published
                ? " Published episodes must be unpublished before their video can be replaced."
                : ""}
            </p>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Video file
              <input
                type="file"
                accept="video/*"
                disabled={busy}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setUpload({ phase: "idle" });
                }}
                className="w-full min-w-0 rounded-input border border-line bg-canvas p-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-fg/10 file:px-3.5 file:py-1.5 file:text-sm file:font-semibold file:text-fg"
              />
            </label>
            {file ? (
              <p className="text-xs text-muted">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            ) : null}

            {upload.phase === "uploading" ? (
              <div className="flex flex-col gap-1.5">
                <ProgressBar
                  value={upload.pct}
                  label={`${Math.round(upload.pct * 100)}% uploaded`}
                />
                <span className="text-xs text-muted">
                  {Math.round(upload.pct * 100)}% uploaded. Keep this tab open.
                </span>
              </div>
            ) : null}
            {upload.phase === "done" ? (
              <p
                role="status"
                className="rounded-input border border-success/35 bg-success/10 px-3 py-2 text-sm text-success"
              >
                Uploaded. Cloudflare is processing the video; press “Sync status” in a minute or
                two.
              </p>
            ) : null}
            {upload.phase === "error" ? (
              <p
                role="alert"
                className="rounded-input border border-error/40 bg-error/10 px-3 py-2 text-sm text-error-soft"
              >
                {upload.message}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2.5">
              <Button size="sm" onClick={startUpload} disabled={!file || busy}>
                {upload.phase === "starting"
                  ? "Starting…"
                  : upload.phase === "uploading"
                    ? "Uploading…"
                    : "Upload"}
              </Button>
              {upload.phase === "uploading" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void tusRef.current?.abort();
                    setUpload({ phase: "idle" });
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </Panel>

          <Panel title="Video status">
            <p className="text-sm text-fg-soft">
              Status normally updates by itself when Cloudflare finishes processing. If it seems
              stuck, ask Cloudflare directly.
            </p>
            {sync.phase === "ok" ? (
              <div className="flex gap-4">
                <div className="relative aspect-video w-2/5 max-w-36 shrink-0 overflow-hidden rounded-input bg-art">
                  {sync.data.thumbnail_url ? (
                    <Image
                      src={sync.data.thumbnail_url}
                      alt=""
                      fill
                      sizes="144px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted">Status</dt>
                  <dd>
                    <StatusPill tone={streamTone(sync.data.stream_status)}>
                      {sync.data.stream_status}
                    </StatusPill>
                  </dd>
                  <dt className="text-muted">Length</dt>
                  <dd>{formatDuration(sync.data.duration_sec) || "–"}</dd>
                  <dt className="text-muted">Result</dt>
                  <dd>
                    {sync.data.result === "updated"
                      ? "Updated from Cloudflare"
                      : sync.data.result === "unchanged"
                        ? "Already up to date"
                        : "Skipped (episode is published)"}
                  </dd>
                </dl>
              </div>
            ) : null}
            {sync.phase === "error" ? (
              <p
                role="alert"
                className="rounded-input border border-error/40 bg-error/10 px-3 py-2 text-sm text-error-soft"
              >
                {sync.message}
              </p>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={runSync}
              disabled={sync.phase === "busy"}
              className="self-start"
            >
              {sync.phase === "busy" ? "Checking…" : "Sync status"}
            </Button>
          </Panel>
        </div>

        <PreviewNotice>
          Editing episode details and publishing need the admin API (Phase 4). Upload and status
          sync above are live.
        </PreviewNotice>
        <Panel title="Episode details">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold md:col-span-2">
              Title
              <input
                defaultValue={episode.title}
                className="h-11 rounded-input border border-line bg-canvas px-3 text-[15px] outline-none focus:border-link"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Access
              <select
                defaultValue={episode.access}
                className="h-11 rounded-input border border-line bg-canvas px-3 text-[15px] outline-none focus:border-link"
              >
                <option value="free">Free (signed-in viewers)</option>
                <option value="vip">VIP only</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button size="sm" disabled>
              Save changes
            </Button>
            <Button size="sm" variant="secondary" disabled>
              {episode.is_published ? "Unpublish" : "Publish (needs a ready video)"}
            </Button>
          </div>
        </Panel>
        <DangerZone what="episode" />
      </div>
    </>
  );
}
