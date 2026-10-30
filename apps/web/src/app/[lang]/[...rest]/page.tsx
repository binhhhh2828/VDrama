import { notFound } from "next/navigation";

// Trang này luôn trả 404 nên không có gì để kiểm tra "instant navigation" của Next.
export const instant = false;

// Đường dẫn không có trang nào: hiện 404 (not-found.tsx của [lang]) đúng ngôn ngữ.
export default function CatchAll() {
  notFound();
}
