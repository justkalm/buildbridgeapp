import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { SEARCH_ENGINES_ALLOWED, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { Fraunces, Inter, Jost } from "next/font/google";
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
// The (kalm) logo face: a thin geometric sans in the Futura family (round
// single-storey a, straight k and l). Used only for the wordmark and the
// tagline, so the name looks the same everywhere as it does in the logo.
const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
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

// Site-wide titles and link previews. Each page sets its own title, shown
// as "<page> | (kalm)"; contractor profiles also set their own preview
// (src/app/contractors/[slug]/layout.tsx). The preview image is the (kalm)
// app icon. robots: see SEARCH_ENGINES_ALLOWED in src/lib/site.ts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "(kalm) | Kaam. Connected.", template: "%s | (kalm)" },
  description: SITE_DESCRIPTION,
  // Home Screen icon and name on iPhone (see src/app/manifest.ts for why
  // Home Screen support matters: it's what allows notifications on iOS).
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "(kalm)", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    title: "(kalm) | Kaam. Connected.",
    description: SITE_DESCRIPTION,
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "(kalm)" }],
  },
  twitter: { card: "summary", title: "(kalm) | Kaam. Connected.", description: SITE_DESCRIPTION, images: ["/icon-512.png"] },
  robots: SEARCH_ENGINES_ALLOWED ? { index: true, follow: true } : { index: false, follow: false },
};

// Every page renders per request so it can carry this request's CSP nonce
// (see proxy.ts). Pages pre-built at deploy time have no request, so no
// nonce, and the browser would block all their scripts.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${jost.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}