import { getServerT, titleMetadata } from "@/lib/i18n/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Checkout } from "@/components/vip/Checkout";

export const generateMetadata = titleMetadata("checkout.metaTitle", { robots: { index: false } });

// PREVIEW trang thanh toán; xem components/vip/Checkout.tsx.
export default async function CheckoutPage({ params }: PageProps<"/[lang]/vip/checkout">) {
  const { t } = getServerT((await params).lang);
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-6 md:pt-10">
      <h1 className="text-[28px] font-extrabold tracking-[-0.01em] md:text-[36px]">
        {t("checkout.metaTitle")}
      </h1>
      <Suspense fallback={<Skeleton className="h-[520px]" />}>
        <Checkout />
      </Suspense>
    </main>
  );
}
