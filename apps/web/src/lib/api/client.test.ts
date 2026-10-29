import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";
import { ApiError } from "./errors";

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Đợi một promise bị từ chối và trả về lỗi (ApiError). */
async function failure(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error("expected the request to fail");
}

const notAuth = () => json(401, { error: { code: "not_authenticated", message: "x" } });
const user = { id: 1, email: "a@example.com", display_name: "A", role: "user", is_vip: false };

/**
 * Giả lập API: `authed` = cookie access còn hạn. Refresh thành công thì bật `authed`.
 * Refresh chờ một chút để các request song song kịp gặp 401 trước khi refresh xong.
 */
function fakeServer({ refreshOk = true } = {}) {
  let authed = false;
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.endsWith("/auth/refresh")) {
      await new Promise((r) => setTimeout(r, 10));
      if (!refreshOk) return json(401, { error: { code: "session_expired", message: "x" } });
      authed = true;
      return new Response(null, { status: 204 });
    }
    if (!authed) return notAuth();
    return json(200, user);
  });
  return {
    fetchMock,
    calls,
    refreshCount: () => calls.filter((c) => c.includes("/auth/refresh")).length,
  };
}

describe("api client refresh", () => {
  it("401 → refresh → retries the request exactly once", async () => {
    const server = fakeServer();
    const api = createApiClient({ fetch: server.fetchMock as typeof fetch });

    await expect(api.request("GET", "/me")).resolves.toEqual(user);
    expect(server.calls).toEqual(["GET /api/v1/me", "POST /api/v1/auth/refresh", "GET /api/v1/me"]);
  });

  it("five parallel 401s share one refresh", async () => {
    const server = fakeServer();
    const api = createApiClient({ fetch: server.fetchMock as typeof fetch });

    const results = await Promise.all(Array.from({ length: 5 }, () => api.request("GET", "/me")));
    expect(results).toHaveLength(5);
    expect(server.refreshCount()).toBe(1);
  });

  it("failed refresh reports sign-out and throws session_expired", async () => {
    const server = fakeServer({ refreshOk: false });
    const onSessionExpired = vi.fn();
    const api = createApiClient({ fetch: server.fetchMock as typeof fetch, onSessionExpired });

    const err = await failure(api.request("GET", "/me"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("session_expired");
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(server.refreshCount()).toBe(1);
  });

  it("me() returns null for guests instead of throwing", async () => {
    const server = fakeServer({ refreshOk: false });
    const api = createApiClient({ fetch: server.fetchMock as typeof fetch });
    await expect(api.me()).resolves.toBeNull();
  });

  it("login does not try to refresh on 401", async () => {
    const fetchMock = vi.fn(async () =>
      json(401, { error: { code: "invalid_credentials", message: "x" } }),
    );
    const api = createApiClient({ fetch: fetchMock as typeof fetch });

    const err = await failure(api.login({ email: "a@example.com", password: "wrong" }));
    expect(err.code).toBe("invalid_credentials");
    expect(err.userMessage).toBe("That email and password don't match.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("other 401 codes are not refreshed", async () => {
    const fetchMock = vi.fn(async () =>
      json(401, { error: { code: "session_expired", message: "x" } }),
    );
    const api = createApiClient({ fetch: fetchMock as typeof fetch });
    await expect(api.request("GET", "/me")).rejects.toMatchObject({ code: "session_expired" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("api client errors", () => {
  it("parses validation fields and 429 Retry-After", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(422, {
          error: {
            code: "validation_error",
            message: "x",
            fields: [{ field: "password", type: "string_too_short", message: "x" }],
          },
        }),
      )
      .mockResolvedValueOnce(
        json(429, { error: { code: "rate_limited", message: "x" } }, { "Retry-After": "90" }),
      );
    const api = createApiClient({ fetch: fetchMock as typeof fetch });

    const validation = await failure(api.request("POST", "/auth/register", { body: {} }));
    expect(validation.fieldError("password")).toBe("Use at least 8 characters.");

    const limited = await failure(api.request("POST", "/auth/login", { body: {} }));
    expect(limited.retryAfter).toBe(90);
    expect(limited.userMessage).toBe("Too many attempts. Please try again in 2 min.");
  });

  it("network failure becomes network_error", async () => {
    const api = createApiClient({
      fetch: (async () => {
        throw new TypeError("Failed to fetch");
      }) as typeof fetch,
    });
    await expect(api.request("GET", "/me")).rejects.toMatchObject({ code: "network_error" });
  });

  it("non-JSON 502 from a proxy maps to internal_error", async () => {
    const api = createApiClient({
      fetch: (async () =>
        new Response("<html>Bad gateway</html>", { status: 502 })) as typeof fetch,
    });
    await expect(api.request("GET", "/me")).rejects.toMatchObject({
      code: "internal_error",
      status: 502,
    });
  });

  it("204 resolves to undefined and sends JSON body", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const api = createApiClient({ fetch: fetchMock as typeof fetch });
    await expect(api.saveProgress(10, 754.6)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/me/history/10");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ progress_sec: 754 });
  });
});
