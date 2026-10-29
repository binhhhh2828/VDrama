import { beforeEach, describe, expect, it } from "vitest";
import { createApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { DEMO_HLS_URL, DEMO_PASSWORD } from "./config";
import { createDemoFetch } from "./api";
import { createStore, type StorageLike } from "./store";

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

let now = Date.parse("2026-10-29T10:00:00Z");
let storage: StorageLike;

function setup() {
  const demoFetch = createDemoFetch({ store: createStore(storage, () => now), now: () => now });
  const api = createApiClient({ fetch: demoFetch as typeof fetch });
  return { demoFetch, api };
}

const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return err as ApiError;
  }
  throw new Error("expected the request to fail");
};

/** Một tập VIP và một tập free của phim đầu danh sách. */
async function episodes(api: ReturnType<typeof setup>["api"]) {
  const list = await api.listSeries({ limit: 50 });
  const eps = await api.adminEpisodes(list.items[0].slug);
  return {
    series: list.items[0],
    free: eps.find((e) => e.access === "free")!,
    vip: eps.find((e) => e.access === "vip")!,
  };
}

beforeEach(() => {
  storage = memoryStorage();
});

describe("catalog", () => {
  it("lists only published series, newest first, and pages with a cursor", async () => {
    const { api } = setup();
    const all = await api.listSeries({ limit: 50 });
    expect(all.items.length).toBeGreaterThan(5);
    expect(all.items.some((s) => s.slug === "the-one-in-my-dream")).toBe(false);
    const dates = all.items.map((s) => Date.parse(s.published_at!));
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);

    const first = await api.listSeries({ limit: 3 });
    expect(first.items).toHaveLength(3);
    const second = await api.listSeries({ limit: 3, cursor: first.next_cursor! });
    expect(second.items[0].id).toBe(all.items[3].id);
  });

  it("sorts hot by view count and filters by genre", async () => {
    const { api } = setup();
    const hot = await api.listSeries({ sort: "hot", limit: 50 });
    const slugs = hot.items.map((s) => s.slug);
    expect(slugs[0]).toBe("sky-of-memories");
    const genre = hot.items[0].genres[0].slug;
    const filtered = await api.listSeries({ genre, limit: 50 });
    expect(filtered.items.every((s) => s.genres.some((g) => g.slug === genre))).toBe(true);
  });

  it("searches by title ignoring case, and rejects short terms", async () => {
    const { demoFetch } = setup();
    const ok = await (await demoFetch("/api/v1/search?q=VIRTUAL")).json();
    expect(ok.items.map((s: { slug: string }) => s.slug)).toContain("virtual-city");
    expect((await demoFetch("/api/v1/search?q=v")).status).toBe(422);
  });

  it("hides drafts from guests and shows them to admins", async () => {
    const { demoFetch, api } = setup();
    expect((await demoFetch("/api/v1/series/the-one-in-my-dream")).status).toBe(404);
    await api.login({ email: "admin@example.com", password: DEMO_PASSWORD });
    const res = await demoFetch("/api/v1/series/the-one-in-my-dream");
    expect(res.status).toBe(200);
    expect((await res.json()).is_published).toBe(false);
    const eps = await api.adminEpisodes("the-one-in-my-dream");
    expect(eps.length).toBeGreaterThan(0);
  });
});

describe("auth", () => {
  it("rejects a wrong password and accepts the demo password", async () => {
    const { api } = setup();
    expect((await failure(api.login({ email: "viewer@example.com", password: "nope" }))).code).toBe(
      "invalid_credentials",
    );
    const user = await api.login({ email: "viewer@example.com", password: DEMO_PASSWORD });
    expect(user.role).toBe("user");
    expect(user.is_vip).toBe(false);
    expect((await api.me())?.email).toBe("viewer@example.com");
  });

  it("treats a guest as signed out and signs out again", async () => {
    const { api } = setup();
    expect(await api.me()).toBeNull();
    await api.login({ email: "vip@example.com", password: DEMO_PASSWORD });
    expect((await api.me())?.is_vip).toBe(true);
    await api.logout();
    expect(await api.me()).toBeNull();
  });

  it("registers a new account, signs in, and refuses a duplicate email", async () => {
    const { api } = setup();
    const body = {
      email: "New@Example.com",
      password: "a-long-pass",
      display_name: "New",
      accept_terms: true,
    };
    const user = await api.register(body);
    expect(user.email).toBe("New@Example.com");
    expect((await api.me())?.id).toBe(user.id);
    await api.logout();
    expect((await failure(api.register(body))).code).toBe("email_taken");
    // Đăng nhập lại bằng tài khoản vừa tạo.
    expect((await api.login({ email: "new@example.com", password: "a-long-pass" })).id).toBe(
      user.id,
    );
  });

  it("reports field errors for a bad sign-up", async () => {
    const { api } = setup();
    const err = await failure(
      api.register({ email: "bad", password: "short", display_name: "", accept_terms: false }),
    );
    expect(err.code).toBe("validation_error");
    expect(err.fields.map((f) => f.field).sort()).toEqual([
      "accept_terms",
      "display_name",
      "email",
      "password",
    ]);
  });

  it("keeps the session across a reload (same storage)", async () => {
    await setup().api.login({ email: "viewer@example.com", password: DEMO_PASSWORD });
    expect((await setup().api.me())?.email).toBe("viewer@example.com");
  });
});

describe("watching", () => {
  it("asks guests to sign in, even for a free episode", async () => {
    const { api } = setup();
    const { free } = await episodes(api);
    expect((await failure(api.play(free.id))).code).toBe("session_expired");
  });

  it("locks VIP episodes for a viewer and opens them for VIP and admin", async () => {
    const { api } = setup();
    const { free, vip } = await episodes(api);

    await api.login({ email: "viewer@example.com", password: DEMO_PASSWORD });
    expect((await api.play(free.id)).hls_url).toBe(DEMO_HLS_URL);
    expect((await failure(api.play(vip.id))).code).toBe("vip_required");
    expect((await failure(api.saveProgress(vip.id, 10))).code).toBe("vip_required");

    await api.login({ email: "vip@example.com", password: DEMO_PASSWORD });
    expect((await api.play(vip.id)).episode_id).toBe(vip.id);

    await api.login({ email: "admin@example.com", password: DEMO_PASSWORD });
    expect((await api.play(vip.id)).episode_id).toBe(vip.id);
  });

  it("unlocks VIP after the demo purchase, and the VIP ends on time", async () => {
    const { demoFetch, api } = setup();
    const { vip } = await episodes(api);
    await api.login({ email: "viewer@example.com", password: DEMO_PASSWORD });
    const res = await demoFetch("/api/v1/demo/vip", {
      method: "POST",
      body: JSON.stringify({ days: 30 }),
    });
    const user = await res.json();
    expect(user.is_vip).toBe(true);
    expect(Date.parse(user.vip_expires_at)).toBe(now + 30 * 86_400_000);
    expect((await api.play(vip.id)).episode_id).toBe(vip.id);

    now += 31 * 86_400_000;
    expect((await failure(api.play(vip.id))).code).toBe("vip_required");
    now -= 31 * 86_400_000;
  });

  it("saves progress, lists one row per series, and removes history", async () => {
    const { api } = setup();
    const { series, free } = await episodes(api);
    await api.login({ email: "viewer@example.com", password: DEMO_PASSWORD });
    await api.saveProgress(free.id, 42);
    const { items } = await api.history();
    expect(items).toHaveLength(1);
    expect(items[0].series.slug).toBe(series.slug);
    expect(items[0].progress_sec).toBe(42);
    const per = await api.seriesProgress(series.slug);
    expect(per.items).toEqual([expect.objectContaining({ episode_id: free.id, progress_sec: 42 })]);

    await api.removeHistory(free.id);
    expect((await api.history()).items).toHaveLength(0);
    await api.saveProgress(free.id, 5);
    await api.clearHistory();
    expect((await api.history()).items).toHaveLength(0);
  });

  it("keeps each account's history separate", async () => {
    const { api } = setup();
    const { free } = await episodes(api);
    await api.login({ email: "viewer@example.com", password: DEMO_PASSWORD });
    await api.saveProgress(free.id, 42);
    await api.login({ email: "vip@example.com", password: DEMO_PASSWORD });
    expect((await api.history()).items).toHaveLength(0);
  });
});

describe("My List", () => {
  it("adds, lists newest first, and removes", async () => {
    const { api } = setup();
    const list = await api.listSeries({ limit: 50 });
    const [a, b] = list.items;
    await api.login({ email: "viewer@example.com", password: DEMO_PASSWORD });
    expect((await api.isFavorite(a.id)).favorited).toBe(false);
    await api.addFavorite(a.id);
    await api.addFavorite(b.id);
    await api.addFavorite(b.id); // lặp lại vẫn ổn
    expect((await api.favorites()).items.map((s) => s.id)).toEqual([b.id, a.id]);
    await api.removeFavorite(b.id);
    expect((await api.isFavorite(b.id)).favorited).toBe(false);
    expect((await api.favorites()).items.map((s) => s.id)).toEqual([a.id]);
  });

  it("needs a signed-in user", async () => {
    const { demoFetch } = setup();
    expect((await demoFetch("/api/v1/me/favorites")).status).toBe(401);
  });
});

describe("admin", () => {
  it("is for admins only", async () => {
    const { api } = setup();
    const { free } = await episodes(api);
    expect((await failure(api.adminStartUpload(free.id, 1000))).code).toBe("session_expired");
    await api.login({ email: "viewer@example.com", password: DEMO_PASSWORD });
    expect((await failure(api.adminStartUpload(free.id, 1000))).code).toBe("forbidden");
  });

  it("refuses upload for a published episode (409) and says Stream isn't set up for a draft (503)", async () => {
    const { api } = setup();
    const { free } = await episodes(api);
    await api.login({ email: "admin@example.com", password: DEMO_PASSWORD });
    expect((await failure(api.adminStartUpload(free.id, 1000))).code).toBe("conflict");
    const draft = (await api.adminEpisodes("parallel-secrets")).find((e) => !e.is_published)!;
    expect((await failure(api.adminStartUpload(draft.id, 1000))).code).toBe("stream_unavailable");
    expect((await failure(api.adminStreamSync(draft.id))).code).toBe("stream_unavailable");
    expect((await api.adminStreamSync(free.id)).result).toBe("skipped_published");
  });
});

describe("store", () => {
  it("falls back to memory when storage throws", async () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const api = createApiClient({
      fetch: createDemoFetch({
        store: createStore(broken, () => now),
        now: () => now,
      }) as typeof fetch,
    });
    await api.login({ email: "viewer@example.com", password: DEMO_PASSWORD });
    expect((await api.me())?.email).toBe("viewer@example.com");
  });

  it("answers unknown paths with 404", async () => {
    const { demoFetch } = setup();
    expect((await demoFetch("/api/v1/nope")).status).toBe(404);
  });
});
