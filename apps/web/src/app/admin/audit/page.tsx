import type { Metadata } from "next";
import { AuditAdmin } from "@/components/admin/AuditAdmin";

export const metadata: Metadata = { title: "Audit log" };
export const instant = false;

export default function Page() {
  return <AuditAdmin />;
}
