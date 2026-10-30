import { describe, expect, it } from "vitest";
import { API_ERROR_CODES, ApiError } from "@/lib/api/errors";
import { formatDate, formatDuration, formatVnd, timeLeft } from "@/lib/format";
import { apiErrorText, fieldErrorText } from "./api-errors";
import { getDictionary } from "./dictionaries";
import { createT } from "./translate";

const en = createT(getDictionary("en"), "en");
const vi = createT(getDictionary("vi"), "vi");

describe("thông báo lỗi API theo ngôn ngữ", () => {
  it("mọi mã lỗi đều có câu ở cả hai ngôn ngữ, câu tiếng Việt khác tiếng Anh", () => {
    for (const code of [...API_ERROR_CODES, "network_error", "unknown_error"] as const) {
      const err = new ApiError(400, code);
      const e = apiErrorText(err, en);
      const v = apiErrorText(err, vi);
      expect(e, code).not.toMatch(/^apiErrors\./);
      expect(v, code).not.toMatch(/^apiErrors\./);
      expect(v, code).not.toBe(e);
    }
  });

  it("câu tiếng Anh khớp ApiError.message (nguồn duy nhất là từ điển)", () => {
    const err = new ApiError(401, "invalid_credentials");
    expect(apiErrorText(err, en)).toBe(err.message);
  });

  it("rate_limited có thời gian chờ: phút hoặc giây", () => {
    expect(apiErrorText(new ApiError(429, "rate_limited", { retryAfter: 120 }), vi)).toContain(
      "2 phút",
    );
    expect(apiErrorText(new ApiError(429, "rate_limited", { retryAfter: 30 }), en)).toContain(
      "30 seconds",
    );
    expect(apiErrorText(new ApiError(429, "rate_limited"), vi)).toBe(
      getDictionary("vi").apiErrors.rate_limited,
    );
  });

  it("lỗi từng trường", () => {
    expect(fieldErrorText({ field: "email", type: "value_error", message: "" }, vi)).toContain(
      "email",
    );
    expect(fieldErrorText({ field: "password", type: "string_too_short", message: "" }, en)).toBe(
      "Use at least 8 characters.",
    );
    expect(fieldErrorText({ field: "x", type: "lạ", message: "" }, vi)).toBe(
      getDictionary("vi").fieldErrors.invalid,
    );
  });
});

describe("định dạng theo ngôn ngữ", () => {
  it("thời lượng và thời gian còn lại", () => {
    expect(formatDuration(1297)).toBe("22 min");
    expect(formatDuration(1297, "vi")).toBe("22 phút");
    expect(formatDuration(3725, "vi")).toBe("1 giờ 2 phút");
    expect(timeLeft(100, 1300)).toBe("20 min left");
    expect(timeLeft(100, 1300, "vi")).toBe("20 phút còn lại");
    expect(timeLeft(1290, 1300, "vi")).toBe("Đã xem");
  });

  it("ngày và số tiền theo quy ước của ngôn ngữ", () => {
    expect(formatDate("2026-11-28T10:00:00Z")).toBe("Nov 28, 2026");
    expect(formatDate("2026-11-28T10:00:00Z", "vi")).toMatch(/28.*11.*2026/);
    expect(formatVnd(259000)).toBe("259,000 VND");
    expect(formatVnd(259000, "vi")).toBe("259.000 VND");
  });
});
