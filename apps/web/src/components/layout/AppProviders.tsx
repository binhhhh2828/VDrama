import type { ReactNode } from "react";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { SessionProvider } from "@/components/session/SessionProvider";
import { VipSheetProvider } from "@/components/vip/VipSheetProvider";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

/** Các provider dùng chung của mọi trang (cả giao diện người xem lẫn admin). */
export function AppProviders({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
      <SessionProvider>
        <VipSheetProvider>
          <DemoBanner />
          {children}
        </VipSheetProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
