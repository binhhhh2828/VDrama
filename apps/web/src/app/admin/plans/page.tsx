import type { Metadata } from "next";
import { PlansAdmin } from "@/components/admin/PlansAdmin";

export const metadata: Metadata = { title: "VIP plans" };
export const instant = false;

export default function Page() {
  return <PlansAdmin />;
}
