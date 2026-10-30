import { notFound } from "next/navigation";

// Đường dẫn không có trang nào: hiện 404 (not-found.tsx của [lang]) đúng ngôn ngữ.
export default function CatchAll() {
  notFound();
}
