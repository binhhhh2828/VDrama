import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { SessionProvider } from "@/components/session/SessionProvider";
import { IS_DEMO } from "@/lib/demo/config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "vietnamese"],
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
  themeColor: "#0b0709",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <SessionProvider>
          <DemoBanner />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
