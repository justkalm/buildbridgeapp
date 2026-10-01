import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import CookieBanner from "@/components/CookieBanner";

// Self-hosted via next/font: the font files are downloaded at build time and
// served from this site, so there's no render-blocking request to Google
// Fonts and no flash of fallback text. Each exposes a CSS variable that
// globals.css maps to --font-display / --font-body.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// viewport-fit=cover lets the page use the full screen on phones with a
// notch or home bar; fixed bars (the profile page's mobile quote bar) then
// pad themselves with env(safe-area-inset-bottom) so they stay clear of it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "(kalm) | Kaam. Connected.",
  // Home Screen icon and name on iPhone (see src/app/manifest.ts for why
  // Home Screen support matters: it's what allows notifications on iOS).
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "(kalm)", statusBarStyle: "default" },
  description:
    "(kalm) connects developers with licensed, verified contractors. See project history with photos, timelines and sizes, and schedule site visits.",
};

// Every page renders per request so it can carry this request's CSP nonce
// (see proxy.ts). Pages pre-built at deploy time have no request, so no
// nonce, and the browser would block all their scripts.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}