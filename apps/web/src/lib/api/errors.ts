import { en } from "@/lib/i18n/dictionaries/en";

// Lỗi API và câu hiển thị tiếng Anh. Giao diện luôn hiện câu theo `code`, không hiện thẳng
// `message` của API (API còn trả tiếng Việt tới Bước 15 của plan frontend).

/** Mã lỗi của API (bảng mã lỗi trong docs/api.md) cộng hai mã chỉ có ở phía trình duyệt. */
export const API_ERROR_CODES = [
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
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number] | "network_error" | "unknown_error";

export type FieldError = { field: string; type: string; message: string };

// Câu tiếng Anh lấy từ từ điển (nguồn duy nhất); giao diện hiện câu theo ngôn ngữ qua `apiErrorText`.
const MESSAGES: Record<ApiErrorCode, string> = en.apiErrors;

/** Câu tiếng Anh cho một mã lỗi; mã lạ thì dùng câu chung. */
export function errorMessage(code: string): string {
  return MESSAGES[code as ApiErrorCode] ?? MESSAGES.unknown_error;
}

/** Câu ngắn cho lỗi validate từng trường (theo `type` của Pydantic), tiếng Anh. */
export function fieldErrorMessage(err: FieldError): string {
  switch (err.type) {
    case "missing":
      return "This field is required.";
    case "string_too_short":
      return err.field === "password" ? "Use at least 8 characters." : "This is too short.";
    case "string_too_long":
      return "This is too long.";
    case "value_error":
      return err.field === "email" ? "Enter a valid email address." : "This value isn't valid.";
    default:
      return "This value isn't valid.";
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: FieldError[];
  /** Số giây cần chờ (chỉ có khi 429). */
  readonly retryAfter: number | null;
  readonly requestId: string | null;

  constructor(
    status: number,
    code: ApiErrorCode,
    opts: { fields?: FieldError[]; retryAfter?: number | null; requestId?: string | null } = {},
  ) {
    super(errorMessage(code));
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = opts.fields ?? [];
    this.retryAfter = opts.retryAfter ?? null;
    this.requestId = opts.requestId ?? null;
  }

  /** Câu hiển thị cho người dùng (429 thì kèm thời gian chờ). */
  get userMessage(): string {
    if (this.code === "rate_limited" && this.retryAfter) {
      const wait =
        this.retryAfter >= 60
          ? `${Math.ceil(this.retryAfter / 60)} min`
          : `${this.retryAfter} seconds`;
      return `Too many attempts. Please try again in ${wait}.`;
    }
    return this.message;
  }

  /** Lỗi của một trường cụ thể (đã dịch sang tiếng Anh), nếu có. */
  fieldError(field: string): string | undefined {
    const err = this.fields.find((f) => f.field === field);
    return err ? fieldErrorMessage(err) : undefined;
  }
}

/** Dựng ApiError từ một response không thành công (thân JSON `{ error: {...} }` hoặc bất kỳ). */
export async function toApiError(res: Response): Promise<ApiError> {
  let code: ApiErrorCode = res.status >= 500 ? "internal_error" : "unknown_error";
  let fields: FieldError[] = [];
  try {
    const body = (await res.json()) as {
      error?: { code?: string; fields?: FieldError[] };
    };
    if (body?.error?.code) code = body.error.code as ApiErrorCode;
    if (Array.isArray(body?.error?.fields)) fields = body.error.fields;
  } catch {
    // Thân không phải JSON (proxy lỗi, HTML...): giữ mã theo status.
  }
  const retry = Number(res.headers.get("Retry-After"));
  return new ApiError(res.status, code, {
    fields,
    retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null,
    requestId: res.headers.get("X-Request-ID"),
  });
}
