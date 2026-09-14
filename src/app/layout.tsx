import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import CookieBanner from "@/components/CookieBanner";

export const metadata: Metadata = {
  title: "(Kalm) — Kaam. Connected.",
  description:
    "(Kalm) connects developers with licensed contractors, backed by verified project history.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}