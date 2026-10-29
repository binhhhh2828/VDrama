import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Checkout } from "@/components/vip/Checkout";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

// PREVIEW trang thanh toán; xem components/vip/Checkout.tsx.
export default function CheckoutPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 md:pt-10">
      <h1 className="text-[28px] font-extrabold tracking-[-0.01em] md:text-[36px]">Checkout</h1>
      <Suspense fallback={<Skeleton className="h-[520px]" />}>
        <Checkout />
      </Suspense>
    </main>
  );
}
