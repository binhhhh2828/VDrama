/**
 * Đường quay lại sau khi đăng nhập (`?next=`). Chỉ nhận đường dẫn trong site ("/..."), không nhận
 * URL tuyệt đối hay "//host" (chống chuyển hướng mở sang trang lừa đảo). Sai thì về trang chủ.
 */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Không quay lại chính các trang đăng nhập.
  if (/^\/(signin|signup)(\/|\?|$)/.test(value)) return fallback;
  return value;
}
