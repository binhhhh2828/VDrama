import type { Metadata } from "next";
import { UsersAdmin } from "@/components/admin/UsersAdmin";

export const metadata: Metadata = { title: "Users" };
export const instant = false;

export default function Page() {
  return <UsersAdmin />;
}
