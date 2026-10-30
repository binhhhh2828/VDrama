import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppProviders } from "@/components/layout/AppProviders";
import { isLocale, LOCALES } from "@/lib/i18n/config";
import { poppins } from "@/lib/site-fonts";
import { siteMetadata, siteViewport } from "@/lib/site-metadata";
import "../globals.css";

export const metadata: Metadata = siteMetadata;
export const viewport = siteViewport;

// Mỗi ngôn ngữ được dựng sẵn tĩnh.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// Layout gốc của giao diện người xem (admin và trang dev có layout gốc riêng ở nhóm (internal)).
export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className={`${poppins.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <AppProviders locale={lang}>{children}</AppProviders>
      </body>
    </html>
  );
}
