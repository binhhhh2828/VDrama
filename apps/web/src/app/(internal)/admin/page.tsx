import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

// Trang cùng cấp với layout không nhận title.template của layout đó, nên ghi đủ tiêu đề.
export const metadata: Metadata = { title: { absolute: "Overview · VDrama Admin" } };
export const instant = false;

export default function AdminHome() {
  return <AdminDashboard />;
}
