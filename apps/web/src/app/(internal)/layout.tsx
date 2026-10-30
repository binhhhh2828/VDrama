import type { Metadata } from "next";
import { AppProviders } from "@/components/layout/AppProviders";
import { bodyFont } from "@/lib/site-fonts";
import { siteMetadata, siteViewport } from "@/lib/site-metadata";
import "../globals.css";

export const metadata: Metadata = siteMetadata;
export const viewport = siteViewport;

// Layout gốc của khu nội bộ (admin, trang dev): chỉ tiếng Anh, địa chỉ không có tiền tố ngôn ngữ.
export default function InternalRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bodyFont.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <AppProviders locale="en">{children}</AppProviders>
      </body>
    </html>
  );
}
