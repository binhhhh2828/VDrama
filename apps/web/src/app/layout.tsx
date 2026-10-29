import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { SessionProvider } from "@/components/session/SessionProvider";
import { VipSheetProvider } from "@/components/vip/VipSheetProvider";
import { IS_DEMO } from "@/lib/demo/config";
import "./globals.css";

// Poppins không phải font biến nên phải liệt kê độ đậm. Không có bộ tiếng Việt (giao diện là tiếng Anh).
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_ORIGIN ?? "http://localhost:3000"),
  title: {
    default: "VDrama — AI Drama · Endless Stories",
    template: "%s · VDrama",
  },
  description: "Short AI drama series you can binge in an evening. Watch free episodes or go VIP.",
  applicationName: "VDrama",
  ...(IS_DEMO ? { robots: { index: false, follow: false } } : {}),
  openGraph: {
    siteName: "VDrama",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#141414",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <SessionProvider>
          <VipSheetProvider>
            <DemoBanner />
            {children}
          </VipSheetProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
