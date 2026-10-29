"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSession } from "@/components/session/SessionProvider";
import { api } from "@/lib/api/client";
import type { SeriesProgressItem } from "@/lib/api/types";

// Phần riêng của người đang xem trên trang phim: tiến độ từng tập và trạng thái My List.
// Lấy một lần trên trình duyệt rồi chia cho nút Continue, nút My List và danh sách tập.

type ViewerData = {
  /** Đã biết người xem là ai và đã tải xong phần riêng (khách: true ngay). */
  ready: boolean;
  progress: Map<number, SeriesProgressItem>; // theo episode_id
  favorited: boolean;
  setFavorited: (value: boolean) => void;
  /** Ghi tiến độ vừa lưu vào bộ nhớ để quay lại tập đó phát tiếp đúng chỗ (không phải tải lại). */
  recordProgress: (episodeId: number, number: number, sec: number) => void;
};

const Ctx = createContext<ViewerData | null>(null);

type Loaded = {
  userId: number;
  progress: Map<number, SeriesProgressItem>;
  favorited: boolean;
};

export function SeriesViewerProvider({
  slug,
  seriesId,
  children,
}: {
  slug: string;
  seriesId: number;
  children: ReactNode;
}) {
  const session = useSession();
  const userId = session.status === "user" ? session.user.id : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (userId === null) return;
    let active = true;
    Promise.all([
      api.seriesProgress(slug).catch(() => ({ items: [] as SeriesProgressItem[] })),
      api.isFavorite(seriesId).catch(() => ({ favorited: false })),
    ]).then(([progress, fav]) => {
      if (!active) return;
      setLoaded({
        userId,
        progress: new Map(progress.items.map((p) => [p.episode_id, p])),
        favorited: fav.favorited,
      });
    });
    return () => {
      active = false;
    };
  }, [userId, slug, seriesId]);

  const setFavorited = useCallback((value: boolean) => {
    setLoaded((prev) => (prev ? { ...prev, favorited: value } : prev));
  }, []);

  const recordProgress = useCallback((episodeId: number, number: number, sec: number) => {
    setLoaded((prev) => {
      if (!prev) return prev;
      const progress = new Map(prev.progress);
      progress.set(episodeId, {
        episode_id: episodeId,
        number,
        progress_sec: sec,
        updated_at: new Date().toISOString(),
      });
      return { ...prev, progress };
    });
  }, []);

  const value = useMemo<ViewerData>(() => {
    const mine = loaded && loaded.userId === userId ? loaded : null;
    return {
      ready: session.status === "guest" || (userId !== null && mine !== null),
      progress: mine?.progress ?? new Map(),
      favorited: mine?.favorited ?? false,
      setFavorited,
      recordProgress,
    };
  }, [loaded, userId, session.status, setFavorited, recordProgress]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSeriesViewer(): ViewerData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSeriesViewer must be used inside <SeriesViewerProvider>");
  return ctx;
}
