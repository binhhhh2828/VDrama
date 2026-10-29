"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { EpisodeThumb } from "@/components/ui/EpisodeThumb";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";
import type { HistoryItem } from "@/lib/api/types";
import { progressRatio, timeLeft } from "@/lib/format";
import { SectionHeader } from "./SectionHeader";

const LIMIT = 8;

/** "Continue watching": chỉ khi đã đăng nhập và có lịch sử. Lấy trên trình duyệt (dữ liệu riêng). */
export function ContinueWatching() {
  const session = useSession();
  const userId = session.status === "user" ? session.user.id : null;
  // Kết quả gắn với user đã tải nó, để đổi tài khoản không hiện nhầm lịch sử người trước.
  const [loaded, setLoaded] = useState<{ userId: number; items: HistoryItem[] } | null>(null);

  useEffect(() => {
    if (userId === null) return;
    let active = true;
    api.history(LIMIT).then(
      (res) => active && setLoaded({ userId, items: res.items }),
      () => active && setLoaded({ userId, items: [] }),
    );
    return () => {
      active = false;
    };
  }, [userId]);

  if (userId === null) return null;
  const items = loaded?.userId === userId ? loaded.items : null;
  if (items !== null && items.length === 0) return null;

  return (
    <section aria-labelledby="continue-h" className="flex flex-col gap-3 md:gap-4">
      <SectionHeader id="continue-h" title="Continue watching" href="/account/history" />
      {/* Điện thoại: trượt ngang; desktop: lưới. */}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] sm:gap-5 sm:overflow-visible sm:px-0">
        {items === null
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex w-[220px] shrink-0 flex-col gap-2 sm:w-auto">
                <Skeleton className="aspect-video" />
                <Skeleton className="h-4 w-2/3 rounded-md" />
              </div>
            ))
          : items.map((h) => (
              <EpisodeThumb
                key={h.series.id}
                href={`/series/${h.series.slug}/episode/${h.episode.number}`}
                title={h.series.title}
                meta={`EP ${h.episode.number} · ${timeLeft(h.progress_sec, h.episode.duration_sec)}`}
                thumbnailUrl={h.episode.thumbnail_url}
                progress={progressRatio(h.progress_sec, h.episode.duration_sec)}
                className="w-[220px] shrink-0 sm:w-auto"
              />
            ))}
      </div>
    </section>
  );
}
