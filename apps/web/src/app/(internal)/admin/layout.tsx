import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · VDrama Admin" },
  robots: { index: false, follow: false },
};

// Trang admin chỉ hiện trên trình duyệt sau khi biết người đăng nhập là admin; server không render
// sẵn nội dung, nên tắt kiểm tra "instant navigation" của Next cho khu vực này.
export const instant = false;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
