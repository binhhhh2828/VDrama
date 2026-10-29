import type { Metadata } from "next";
import { MyList } from "@/components/account/MyList";

export const metadata: Metadata = { title: "My List" };

// Nội dung chỉ có trên trình duyệt sau khi biết ai đăng nhập (xem account/layout.tsx).
export const instant = false;

export default function MyListPage() {
  return <MyList />;
}
