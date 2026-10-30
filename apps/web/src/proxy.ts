import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { decideRoute } from "@/lib/i18n/routing";

// Định tuyến theo ngôn ngữ: quy tắc nằm ở lib/i18n/routing.ts (có test).
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const decision = decideRoute({
    pathname,
    search,
    method: request.method,
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  if (decision.type === "next") return NextResponse.next();
  const url = new URL(decision.to, request.url);
  const response =
    decision.type === "rewrite"
      ? NextResponse.rewrite(url)
      : NextResponse.redirect(url, decision.status);
  // Kết quả phụ thuộc cookie và trình duyệt: bộ nhớ đệm chung không được dùng lẫn.
  response.headers.append("Vary", "Cookie, Accept-Language");
  return response;
}

export const config = {
  // Bỏ qua tài nguyên nội bộ, API, admin, dev và mọi file có đuôi (ảnh, icon, robots.txt...).
  matcher: ["/((?!_next/|api/|admin(?:/|$)|dev(?:/|$)|.*\\..*).*)"],
};
