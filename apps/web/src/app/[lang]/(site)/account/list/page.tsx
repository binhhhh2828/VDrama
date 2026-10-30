import { titleMetadata } from "@/lib/i18n/server";
import { MyList } from "@/components/account/MyList";

export const generateMetadata = titleMetadata("nav.myList");

// Nội dung chỉ có trên trình duyệt sau khi biết ai đăng nhập (xem account/layout.tsx).
export const instant = false;

export default function MyListPage() {
  return <MyList />;
}
