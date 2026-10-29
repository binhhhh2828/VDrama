import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { PaymentsAdmin } from "@/components/admin/PaymentsAdmin";

export const metadata: Metadata = { title: "Payments" };
export const instant = false;

export default function Page() {
  // useSearchParams (mở sẵn đơn theo ?order=) cần ranh giới Suspense.
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PaymentsAdmin />
    </Suspense>
  );
}
