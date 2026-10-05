import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { SEARCH_ENGINES_ALLOWED, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { Instrument_Sans, Jost } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import CookieBanner from "@/components/CookieBanner";

// Self-hosted via next/font: the font files are downloaded at build time and
// served from this site, so there's no render-blocking request to Google
// Fonts and no flash of fallback text. Each exposes a CSS variable that
// globals.css maps to --font-display / --font-body.
// Body text (5 Oct 2026): Instrument Sans in place of Inter. A little narrower
// and more editorial than Inter, so the site stops looking like the default
// template, and it sits well beside the geometric logo face.
const bodyFont = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body-face",
  display: "swap",
});
// The (kalm) logo face: a thin geometric sans in the Futura family (round
// single-storey a, straight k and l). Used for the wordmark, the tagline and
// every heading (--font-display), so the whole site speaks in the logo's voice.
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
// (src/app/contractors/[slug]/layout.tsx). The preview image is the wide
// wordmark picture drawn in src/app/opengraph-image.tsx. robots: see
// SEARCH_ENGINES_ALLOWED in src/lib/site.ts.
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
  },
  twitter: { card: "summary_large_image", title: "(kalm) | Kaam. Connected.", description: SITE_DESCRIPTION },
  robots: SEARCH_ENGINES_ALLOWED ? { index: true, follow: true } : { index: false, follow: false },
};

// Every page renders per request so it can carry this request's CSP nonce
// (see proxy.ts). Pages pre-built at deploy time have no request, so no
// nonce, and the browser would block all their scripts.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html lang="en" className={`${bodyFont.variable} ${jost.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}