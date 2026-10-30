"use client";

import NextLink from "next/link";
import {
  usePathname as useNextPathname,
  useRouter as useNextRouter,
  useSearchParams,
} from "next/navigation";
import { useMemo, type ComponentProps } from "react";
import { localePath, splitLocale } from "@/lib/i18n/paths";
import { useLocale } from "./I18nProvider";

export { useSearchParams };

/** `next/link` tự thêm tiền tố ngôn ngữ (`/vi`) vào địa chỉ nội bộ. Dùng thay `next/link` ở giao diện người xem. */
export function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  return <NextLink href={typeof href === "string" ? localePath(locale, href) : href} {...props} />;
}

/** Đường dẫn hiện tại **không có** tiền tố ngôn ngữ, để so sánh với `/browse`, `/account`... */
export function usePathname(): string {
  return splitLocale(useNextPathname()).path;
}

/** `useRouter` của Next nhưng `push`/`replace`/`prefetch` tự thêm tiền tố ngôn ngữ. */
export function useRouter() {
  const router = useNextRouter();
  const locale = useLocale();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(localePath(locale, href), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(localePath(locale, href), options),
      prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) =>
        router.prefetch(localePath(locale, href), options),
    }),
    [router, locale],
  );
}
