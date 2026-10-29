// API giả cho bản demo tĩnh: một `fetch` trả lời các đường dẫn `/api/v1/...` ngay trong trình duyệt
// (và trên server khi đọc catalog), theo đúng định dạng và mã lỗi của docs/api.md. Chỉ để xem
// giao diện: phân quyền ở đây là mô phỏng, không phải bảo mật.

import type {
  Episode,
  Genre,
  HistoryItem,
  PlayInfo,
  SeriesCard,
  SeriesDetail,
  StreamSyncResult,
  User,
} from "@/lib/api/types";
import { DEMO_HLS_URL } from "./config";
import rawData from "./data.json";
import { createStore, type DemoState, type DemoStore, type StoredUser } from "./store";

type Data = { genres: Genre[]; series: SeriesDetail[]; episodes: Record<string, Episode[]> };
const data = rawData as unknown as Data;

const PASSWORD_MIN = 8;
const DAY = 86_400_000;

type Fail = {
  status: number;
  code: string;
  fields?: { field: string; type: string; message: string }[];
};
class DemoError extends Error {
  constructor(readonly fail: Fail) {
    super(fail.code);
  }
}
const fail = (status: number, code: string, fields?: Fail["fields"]) =>
  new DemoError({ status, code, fields });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const noContent = () => new Response(null, { status: 204 });

const CARD_KEYS: (keyof SeriesCard)[] = [
  "id",
  "slug",
  "title",
  "poster_url",
  "banner_url",
  "year",
  "country",
  "status",
  "total_episodes",
  "published_at",
  "genres",
];
const toCard = (s: SeriesDetail): SeriesCard =>
  Object.fromEntries(CARD_KEYS.map((k) => [k, s[k]])) as SeriesCard;

/** Bỏ dấu, hạ chữ thường: "Nàng Thơ" khớp "nang tho". */
const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

const isVip = (u: StoredUser, now: number) =>
  u.vip_expires_at !== null && Date.parse(u.vip_expires_at) > now;

const toUser = (u: StoredUser, now: number): User => ({
  id: u.id,
  email: u.email,
  display_name: u.display_name,
  avatar_url: null,
  role: u.role,
  email_verified: true,
  created_at: u.created_at,
  vip_expires_at: u.vip_expires_at,
  is_vip: isVip(u, now),
});

type Page = { items: SeriesCard[]; next_cursor: string | null };

/** Cắt một trang theo con trỏ (con trỏ chỉ là vị trí bắt đầu, đủ cho dữ liệu mẫu nhỏ). */
function paginate(all: SeriesCard[], limitRaw: string | null, cursor: string | null): Page {
  const limit = Math.min(50, Math.max(1, Number(limitRaw) || 20));
  const start = cursor?.startsWith("o:") ? Number(cursor.slice(2)) || 0 : 0;
  const items = all.slice(start, start + limit);
  const next = start + limit < all.length ? `o:${start + limit}` : null;
  return { items, next_cursor: next };
}

export type DemoFetch = typeof fetch & { store: DemoStore };

export function createDemoFetch(
  opts: { store?: DemoStore; now?: () => number; playUrl?: string } = {},
): DemoFetch {
  const now = opts.now ?? Date.now;
  const store = opts.store ?? createStore(null, now);
  const playUrl = opts.playUrl ?? DEMO_HLS_URL;

  const allEpisodes = Object.entries(data.episodes).flatMap(([slug, eps]) =>
    eps.map((e) => ({ ep: e, slug })),
  );
  const seriesBySlug = new Map(data.series.map((s) => [s.slug, s]));
  const seriesById = new Map(data.series.map((s) => [s.id, s]));

  const currentUser = (st: DemoState) =>
    st.sessionUserId === null ? null : (st.users.find((u) => u.id === st.sessionUserId) ?? null);
  const requireUser = (st: DemoState) => {
    const u = currentUser(st);
    if (!u) throw fail(401, "not_authenticated");
    return u;
  };
  const requireAdmin = (st: DemoState) => {
    const u = requireUser(st);
    if (u.role !== "admin") throw fail(403, "forbidden");
    return u;
  };

  /** Phim người này xem được: đã xuất bản, hoặc chưa xuất bản nhưng là admin. */
  const visibleSeries = (st: DemoState, slug: string) => {
    const s = seriesBySlug.get(slug);
    if (!s) return null;
    return s.is_published || currentUser(st)?.role === "admin" ? s : null;
  };
  const publishedSeries = () => data.series.filter((s) => s.is_published).sort(byNew);
  const byNew = (a: SeriesDetail, b: SeriesDetail) =>
    Date.parse(b.published_at ?? "0") - Date.parse(a.published_at ?? "0") || b.id - a.id;
  const byHot = (a: SeriesDetail, b: SeriesDetail) => b.view_count - a.view_count || byNew(a, b);

  /** Giống `find_watchable_episode` của backend: 404 → 401 → 403. */
  function watchable(st: DemoState, episodeId: number) {
    const found = allEpisodes.find((x) => x.ep.id === episodeId);
    const user = currentUser(st);
    const series = found ? seriesBySlug.get(found.slug) : undefined;
    const admin = user?.role === "admin";
    if (!found || !series || ((!found.ep.is_published || !series.is_published) && !admin)) {
      throw fail(404, "not_found");
    }
    if (!user) throw fail(401, "not_authenticated");
    if (found.ep.access === "vip" && !admin && !isVip(user, now())) throw fail(403, "vip_required");
    return { ...found, series, user };
  }

  function historyItems(st: DemoState, user: StoredUser): HistoryItem[] {
    const mine = st.history[user.id] ?? {};
    const latest = new Map<number, HistoryItem>();
    for (const [epId, h] of Object.entries(mine)) {
      const found = allEpisodes.find((x) => x.ep.id === Number(epId));
      const series = found ? seriesBySlug.get(found.slug) : undefined;
      if (!found || !series || !found.ep.is_published || !series.is_published) continue;
      const prev = latest.get(series.id);
      if (!prev || Date.parse(h.updated_at) > Date.parse(prev.updated_at)) {
        latest.set(series.id, {
          series: toCard(series),
          episode: found.ep,
          progress_sec: h.progress_sec,
          updated_at: h.updated_at,
        });
      }
    }
    return [...latest.values()].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }

  async function route(method: string, url: URL, body: unknown): Promise<Response> {
    const path = url.pathname.replace(/^.*\/api\/v1/, "");
    const p = url.searchParams;
    const st = store.read();
    let m: RegExpMatchArray | null;

    const mutate = (fn: (s: DemoState) => void) => {
      fn(st);
      store.write(st);
    };

    // --- Catalog ---
    if (method === "GET" && path === "/genres") {
      return json([...data.genres].sort((a, b) => a.name.localeCompare(b.name)));
    }
    if (method === "GET" && path === "/series") {
      let list = publishedSeries();
      const genre = p.get("genre");
      if (genre) list = list.filter((s) => s.genres.some((g) => g.slug === genre));
      if (p.get("with_banner") === "true") list = list.filter((s) => s.banner_url);
      if (p.get("sort") === "hot") list = [...list].sort(byHot);
      return json(paginate(list.map(toCard), p.get("limit"), p.get("cursor")));
    }
    if (method === "GET" && path === "/search") {
      const q = (p.get("q") ?? "").trim();
      if (q.length < 2 || q.length > 100)
        throw fail(422, "validation_error", [
          { field: "q", type: "string_too_short", message: "" },
        ]);
      const term = fold(q);
      const limit = Math.min(50, Math.max(1, Number(p.get("limit")) || 20));
      const hits = publishedSeries()
        .filter((s) => fold(s.title).includes(term))
        // Tên bắt đầu bằng từ khóa đứng trước, rồi tới phim mới hơn.
        .sort(
          (a, b) => Number(fold(b.title).startsWith(term)) - Number(fold(a.title).startsWith(term)),
        )
        .slice(0, limit);
      return json({ items: hits.map(toCard) });
    }
    if (method === "GET" && (m = path.match(/^\/series\/([^/]+)$/))) {
      const s = visibleSeries(st, decodeURIComponent(m[1]));
      if (!s) throw fail(404, "not_found");
      return json(s);
    }
    if (method === "GET" && (m = path.match(/^\/series\/([^/]+)\/episodes$/))) {
      const slug = decodeURIComponent(m[1]);
      if (!visibleSeries(st, slug)) throw fail(404, "not_found");
      const admin = currentUser(st)?.role === "admin";
      const eps = data.episodes[slug] ?? [];
      return json(eps.filter((e) => admin || e.is_published).sort((a, b) => a.number - b.number));
    }

    // --- Auth ---
    if (method === "POST" && path === "/auth/register") {
      const b = (body ?? {}) as Record<string, unknown>;
      const email = String(b.email ?? "").trim();
      const password = String(b.password ?? "");
      const name = String(b.display_name ?? "").trim();
      const fields: NonNullable<Fail["fields"]> = [];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fields.push({ field: "email", type: "value_error", message: "" });
      if (password.length < PASSWORD_MIN)
        fields.push({ field: "password", type: "string_too_short", message: "" });
      else if (password.trim().toLowerCase() === email.toLowerCase())
        fields.push({ field: "password", type: "value_error", message: "" });
      if (!name) fields.push({ field: "display_name", type: "string_too_short", message: "" });
      if (b.accept_terms !== true)
        fields.push({ field: "accept_terms", type: "value_error", message: "" });
      if (fields.length) throw fail(422, "validation_error", fields);
      if (st.users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
        throw fail(409, "email_taken");
      const user: StoredUser = {
        id: st.nextUserId,
        email,
        display_name: name,
        role: "user",
        password,
        created_at: new Date(now()).toISOString(),
        vip_expires_at: null,
      };
      mutate((s) => {
        s.users.push(user);
        s.nextUserId += 1;
        s.sessionUserId = user.id;
      });
      return json(toUser(user, now()), 201);
    }
    if (method === "POST" && path === "/auth/login") {
      const b = (body ?? {}) as Record<string, unknown>;
      const email = String(b.email ?? "")
        .trim()
        .toLowerCase();
      const user = st.users.find((u) => u.email.toLowerCase() === email);
      if (!user || user.password !== String(b.password ?? ""))
        throw fail(401, "invalid_credentials");
      mutate((s) => (s.sessionUserId = user.id));
      return json(toUser(user, now()));
    }
    if (method === "POST" && path === "/auth/logout") {
      mutate((s) => (s.sessionUserId = null));
      return noContent();
    }
    if (method === "POST" && path === "/auth/refresh") {
      requireUser(st);
      return noContent();
    }
    if (method === "GET" && path === "/me") {
      return json(toUser(requireUser(st), now()));
    }

    // --- Xem tập ---
    if (method === "GET" && (m = path.match(/^\/episodes\/(\d+)\/play$/))) {
      const { ep } = watchable(st, Number(m[1]));
      const expires = new Date(now() + 3 * 3_600_000).toISOString();
      const info: PlayInfo = {
        episode_id: ep.id,
        hls_url: playUrl,
        dash_url: playUrl,
        iframe_url: playUrl,
        expires_at: expires,
      };
      return json(info);
    }

    // --- Lịch sử xem ---
    if (method === "PUT" && (m = path.match(/^\/me\/history\/(\d+)$/))) {
      const { ep, user } = watchable(st, Number(m[1]));
      const sec = (body as { progress_sec?: unknown } | null)?.progress_sec;
      if (typeof sec !== "number" || !Number.isFinite(sec) || sec < 0 || sec > 86_400) {
        throw fail(422, "validation_error", [
          { field: "progress_sec", type: "value_error", message: "" },
        ]);
      }
      const capped = ep.duration_sec ? Math.min(sec, ep.duration_sec) : sec;
      mutate((s) => {
        const mine = (s.history[user.id] ??= {});
        mine[ep.id] = {
          progress_sec: Math.floor(capped),
          updated_at: new Date(now()).toISOString(),
        };
      });
      return noContent();
    }
    if (method === "GET" && path === "/me/history") {
      const user = requireUser(st);
      const limit = Math.min(50, Math.max(1, Number(p.get("limit")) || 20));
      return json({ items: historyItems(st, user).slice(0, limit) });
    }
    if (method === "GET" && (m = path.match(/^\/me\/history\/series\/([^/]+)$/))) {
      const user = requireUser(st);
      const slug = decodeURIComponent(m[1]);
      if (!visibleSeries(st, slug)) throw fail(404, "not_found");
      const mine = st.history[user.id] ?? {};
      const items = (data.episodes[slug] ?? [])
        .filter((e) => e.is_published && mine[e.id])
        .sort((a, b) => a.number - b.number)
        .map((e) => ({
          episode_id: e.id,
          number: e.number,
          progress_sec: mine[e.id].progress_sec,
          updated_at: mine[e.id].updated_at,
        }));
      return json({ items });
    }
    if (method === "DELETE" && (m = path.match(/^\/me\/history\/(\d+)$/))) {
      const user = requireUser(st);
      mutate((s) => {
        delete s.history[user.id]?.[m![1]];
      });
      return noContent();
    }
    if (method === "DELETE" && path === "/me/history") {
      const user = requireUser(st);
      mutate((s) => (s.history[user.id] = {}));
      return noContent();
    }

    // --- Yêu thích ---
    if (method === "GET" && path === "/me/favorites") {
      const user = requireUser(st);
      const cards = (st.favorites[user.id] ?? [])
        .map((id) => seriesById.get(id))
        .filter((s): s is SeriesDetail => !!s && s.is_published)
        .map(toCard);
      return json(paginate(cards, p.get("limit"), p.get("cursor")));
    }
    if ((m = path.match(/^\/me\/favorites\/(\d+)$/))) {
      const user = requireUser(st);
      const id = Number(m[1]);
      const ids = st.favorites[user.id] ?? [];
      if (method === "GET") return json({ favorited: ids.includes(id) });
      if (method === "PUT") {
        const s = seriesById.get(id);
        if (!s || !s.is_published) throw fail(404, "not_found");
        if (!ids.includes(id)) mutate((x) => (x.favorites[user.id] = [id, ...ids]));
        return noContent();
      }
      if (method === "DELETE") {
        mutate((x) => (x.favorites[user.id] = ids.filter((v) => v !== id)));
        return noContent();
      }
    }

    // --- Admin ---
    if (method === "POST" && (m = path.match(/^\/admin\/episodes\/(\d+)\/(upload|stream-sync)$/))) {
      requireAdmin(st);
      const found = allEpisodes.find((x) => x.ep.id === Number(m![1]));
      if (!found) throw fail(404, "not_found");
      if (m[2] === "upload") {
        if (found.ep.is_published) throw fail(409, "conflict");
        throw fail(503, "stream_unavailable"); // bản demo không có Cloudflare Stream
      }
      if (!found.ep.is_published) throw fail(503, "stream_unavailable");
      const result: StreamSyncResult = {
        episode_id: found.ep.id,
        video_id: "demo-video",
        stream_status: "ready",
        duration_sec: found.ep.duration_sec,
        thumbnail_url: found.ep.thumbnail_url,
        result: "skipped_published",
      };
      return json(result);
    }

    // --- Chỉ có ở bản demo: "mua VIP" giả ---
    if (method === "POST" && path === "/demo/vip") {
      const user = requireUser(st);
      const days = Number((body as { days?: unknown } | null)?.days);
      if (!Number.isInteger(days) || days < 1 || days > 400) throw fail(422, "validation_error");
      const base = isVip(user, now()) ? Date.parse(user.vip_expires_at!) : now();
      const until = new Date(base + days * DAY).toISOString();
      mutate((s) => {
        s.users.find((u) => u.id === user.id)!.vip_expires_at = until;
      });
      return json(toUser({ ...user, vip_expires_at: until }, now()));
    }

    if (/^\/(series|genres|search|me|auth|episodes|admin|demo)(\/|$)/.test(path)) {
      throw fail(
        path.startsWith("/me") ? 404 : 405,
        path.startsWith("/me") ? "not_found" : "method_not_allowed",
      );
    }
    throw fail(404, "not_found");
  }

  const demoFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req?.url ?? String(input), "http://demo.local");
    const method = (init?.method ?? req?.method ?? "GET").toUpperCase();
    let body: unknown = null;
    const raw = init?.body ?? null;
    if (typeof raw === "string" && raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: { code: "bad_request", message: "Invalid JSON" } }, 400);
      }
    }
    try {
      return await route(method, url, body);
    } catch (err) {
      if (err instanceof DemoError) {
        const { status, code, fields } = err.fail;
        return json({ error: { code, message: code, ...(fields ? { fields } : {}) } }, status);
      }
      throw err;
    }
  }) as DemoFetch;
  demoFetch.store = store;
  return demoFetch;
}
