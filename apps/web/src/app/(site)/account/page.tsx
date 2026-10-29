import type { Metadata } from "next";
import { AccountOverview } from "@/components/account/AccountOverview";

export const metadata: Metadata = { title: "My account" };

// Nội dung chỉ có trên trình duyệt sau khi biết ai đăng nhập (xem account/layout.tsx).
export const instant = false;

export default function AccountPage() {
  return <AccountOverview />;
}
