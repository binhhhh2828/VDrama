// Client gọi API từ trình duyệt (dữ liệu theo người dùng: /me, play, lịch sử, yêu thích, admin).
// Gọi `/api/v1/...` cùng domain, cookie httpOnly tự đi kèm; frontend không bao giờ cầm token.
//
// Access token sống 15 phút. Gặp 401 `not_authenticated` thì gọi `POST /auth/refresh` MỘT lần rồi
// gửi lại request; nhiều request cùng gặp 401 thì dùng chung một lần refresh (refresh xoay vòng
// token, refresh song song dễ bị coi là dùng lại token cũ). Refresh thất bại = đã đăng xuất.

import { ApiError, toApiError } from "./errors";
import type {
  Episode,
  HistoryItem,
  Page,
  PlayInfo,
  SeriesCard,
  SeriesProgressItem,
  StreamSyncResult,
  UploadTicket,
  User,
} from "./types";

type Method = "GET" | "POST" | "PUT" | "DELETE";

type RequestOptions = {
  body?: unknown;
  /** Không tự refresh khi 401 (các endpoint đăng nhập/refresh). */
  noRefresh?: boolean;
  /** Gửi được cả khi trang đang đóng (lưu tiến độ lúc tắt tab). */
  keepalive?: boolean;
  signal?: AbortSignal;
};

export type ApiClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Gọi khi phiên hết hạn hẳn (refresh thất bại), để giao diện chuyển về trạng thái khách. */
  onSessionExpired?: () => void;
};

export function createApiClient(opts: ApiClientOptions = {}) {
  const base = (opts.baseUrl ?? "/api/v1").replace(/\/$/, "");
  const doFetch =
    opts.fetch ??
    (async (...args: Parameters<typeof fetch>) => {
      // Điều kiện viết thẳng ra đây để bản build thường loại hẳn nhánh (và dữ liệu mẫu) khỏi bundle.
      if (process.env.NEXT_PUBLIC_DEMO === "true") {
        // Bản demo tĩnh: API giả chạy ngay trong trình duyệt (docs/plans/gd3-netlify-demo.md).
        const { demoFetch } = await import("@/lib/demo/instance");
        return demoFetch(...args);
      }
      return fetch(...args);
    });
  let refreshing: Promise<boolean> | null = null;

  function refreshOnce(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const res = await doFetch(`${base}/auth/refresh`, {
          method: "POST",
          credentials: "same-origin",
        });
        if (!res.ok) opts.onSessionExpired?.();
        return res.ok;
      } catch {
        return false;
      } finally {
        // Request đến sau khi xong lượt này mà vẫn 401 thì được refresh lượt mới.
        queueMicrotask(() => {
          refreshing = null;
        });
      }
    })();
    return refreshing;
  }

  async function send(method: Method, path: string, o: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (o.body !== undefined) headers["Content-Type"] = "application/json";
    try {
      return await doFetch(`${base}${path}`, {
        method,
        headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        credentials: "same-origin",
        cache: "no-store",
        keepalive: o.keepalive,
        signal: o.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ApiError(0, "network_error");
    }
  }

  async function request<T>(method: Method, path: string, o: RequestOptions = {}): Promise<T> {
    let res = await send(method, path, o);
    if (res.status === 401 && !o.noRefresh) {
      const err = await toApiError(res.clone());
      if (err.code === "not_authenticated") {
        if (!(await refreshOnce())) throw new ApiError(401, "session_expired");
        res = await send(method, path, o);
      }
    }
    if (!res.ok) throw await toApiError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const q = (params: Record<string, string | number | undefined | null>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v != null && v !== "") qs.set(k, String(v));
    const s = qs.toString();
    return s ? `?${s}` : "";
  };

  return {
    request,

    // --- Auth ---
    register: (body: {
      email: string;
      password: string;
      display_name: string;
      accept_terms: boolean;
    }) => request<User>("POST", "/auth/register", { body, noRefresh: true }),
    login: (body: { email: string; password: string }) =>
      request<User>("POST", "/auth/login", { body, noRefresh: true }),
    logout: () => request<void>("POST", "/auth/logout", { noRefresh: true }),
    /** User hiện tại, hoặc null nếu là khách (đã thử refresh). */
    me: async (): Promise<User | null> => {
      try {
        return await request<User>("GET", "/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },

    // --- Catalog (trang sau của danh sách, khi bấm "Load more") ---
    listSeries: (params: { sort?: string; genre?: string; limit?: number; cursor?: string }) =>
      request<Page<SeriesCard>>("GET", `/series${q(params)}`),

    // --- Xem tập ---
    play: (episodeId: number) => request<PlayInfo>("GET", `/episodes/${episodeId}/play`),

    // --- Lịch sử xem ---
    saveProgress: (episodeId: number, progressSec: number, opts: { keepalive?: boolean } = {}) =>
      request<void>("PUT", `/me/history/${episodeId}`, {
        body: { progress_sec: Math.max(0, Math.floor(progressSec)) },
        keepalive: opts.keepalive,
      }),
    history: (limit = 20) => request<{ items: HistoryItem[] }>("GET", `/me/history${q({ limit })}`),
    seriesProgress: (slug: string) =>
      request<{ items: SeriesProgressItem[] }>(
        "GET",
        `/me/history/series/${encodeURIComponent(slug)}`,
      ),
    removeHistory: (episodeId: number) => request<void>("DELETE", `/me/history/${episodeId}`),
    clearHistory: () => request<void>("DELETE", "/me/history"),

    // --- Yêu thích (My List) ---
    favorites: (cursor?: string | null, limit = 20) =>
      request<Page<SeriesCard>>("GET", `/me/favorites${q({ limit, cursor })}`),
    isFavorite: (seriesId: number) =>
      request<{ favorited: boolean }>("GET", `/me/favorites/${seriesId}`),
    addFavorite: (seriesId: number) => request<void>("PUT", `/me/favorites/${seriesId}`),
    removeFavorite: (seriesId: number) => request<void>("DELETE", `/me/favorites/${seriesId}`),

    // --- Admin (catalog đọc cả bản nháp khi đã đăng nhập admin) ---
    adminEpisodes: (slug: string) =>
      request<Episode[]>("GET", `/series/${encodeURIComponent(slug)}/episodes`),
    adminStartUpload: (episodeId: number, sizeBytes: number) =>
      request<UploadTicket>("POST", `/admin/episodes/${episodeId}/upload`, {
        body: { size_bytes: sizeBytes },
      }),
    adminStreamSync: (episodeId: number) =>
      request<StreamSyncResult>("POST", `/admin/episodes/${episodeId}/stream-sync`),

    // --- Chỉ có ở bản demo: "mua VIP" giả (không có ở API thật) ---
    demoBuyVip: (days: number) => request<User>("POST", "/demo/vip", { body: { days } }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Bộ lắng nghe "phiên đã hết" dùng chung cho cả app (header, trang tài khoản...). */
const sessionListeners = new Set<() => void>();
export function onSessionExpired(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

/** Client dùng chung trong trình duyệt. */
export const api = createApiClient({
  onSessionExpired: () => sessionListeners.forEach((fn) => fn()),
});
