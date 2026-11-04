import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { publicEnv } from "@/config/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "VibeSec Security Health — Free Website Security Health Check",
    template: "%s · VibeSec Security Health",
  },
  description:
    "Know Your Website's Security Health Before Problems Become Expensive. Free preliminary security configuration check for websites, SaaS platforms and AI-built applications.",
  openGraph: {
    title: "VibeSec Security Health",
    description: "Free preliminary website security health check and professional application security services.",
    type: "website",
  },
  icons: { icon: "/icons/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#060b16", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
