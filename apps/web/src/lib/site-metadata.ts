import type { Metadata, Viewport } from "next";
import { IS_DEMO } from "@/lib/demo/config";

export const siteMetadata: Metadata = {
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

export const siteViewport: Viewport = {
  themeColor: "#141414",
  colorScheme: "dark",
};
