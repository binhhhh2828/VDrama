import { ApiError, type FieldError } from "@/lib/api/errors";
import type { T, TKey } from "./translate";

const KNOWN = new Set<string>([
  "bad_request",
  "validation_error",
  "not_authenticated",
  "session_expired",
  "invalid_credentials",
  "forbidden",
  "account_disabled",
  "vip_required",
  "not_found",
  "method_not_allowed",
  "email_taken",
  "video_not_ready",
  "conflict",
  "payload_too_large",
  "invalid_signature",
  "stream_provider_error",
  "stream_unavailable",
  "rate_limited",
  "internal_error",
  "network_error",
  "unknown_error",
]);

/** Câu hiển thị cho một mã lỗi API theo ngôn ngữ của trang; mã lạ thì dùng câu chung. */
export function apiErrorText(err: ApiError, t: T): string {
  if (err.code === "rate_limited" && err.retryAfter) {
    return err.retryAfter >= 60
      ? t("apiErrors.rateLimitedMinutes", { n: Math.ceil(err.retryAfter / 60) })
      : t("apiErrors.rateLimitedSeconds", { n: err.retryAfter });
  }
  const code = KNOWN.has(err.code) ? err.code : "unknown_error";
  return t(`apiErrors.${code}` as TKey);
}

/** Câu ngắn cho lỗi validate từng trường (theo `type` của Pydantic). */
export function fieldErrorText(err: FieldError, t: T): string {
  switch (err.type) {
    case "missing":
      return t("fieldErrors.required");
    case "string_too_short":
      return err.field === "password" ? t("fieldErrors.passwordShort") : t("fieldErrors.tooShort");
    case "string_too_long":
      return t("fieldErrors.tooLong");
    case "value_error":
      return err.field === "email" ? t("fieldErrors.emailInvalid") : t("fieldErrors.invalid");
    default:
      return t("fieldErrors.invalid");
  }
}
