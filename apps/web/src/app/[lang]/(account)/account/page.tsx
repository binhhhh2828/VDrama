import { titleMetadata } from "@/lib/i18n/server";
import { AccountOverview } from "@/components/account/AccountOverview";

export const generateMetadata = titleMetadata("account.title");

// Nội dung chỉ có trên trình duyệt sau khi biết ai đăng nhập (xem account/layout.tsx).
export const instant = false;

export default function AccountPage() {
  return <AccountOverview />;
}
