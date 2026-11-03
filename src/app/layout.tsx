import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { Inter, Syne, JetBrains_Mono, Silkscreen } from "next/font/google";
import AppNavbar from "@/components/AppNavbar";
import Footer from "@/components/Footer";
import DeferredVercelMetrics from "@/components/DeferredVercelMetrics";
import Providers from "./providers";
import OfflineBanner from "@/components/OfflineBanner";
import "./globals.css";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { getLocaleDirection } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/locale";
import { getMessagesForLocale } from "@/i18n/messages";

const inter = Inter({ subsets: ["latin"], display: "swap" });
const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["700", "800"],
  display: "swap",
  preload: false,
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700"],
  display: "optional",
  preload: false,
});

// The arcade display face: headings, HUD labels and scores. Never body text.
const pixel = Silkscreen({
  subsets: ["latin"],
  variable: "--font-pixel",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://devtrack.live"
  ),
  title: {
    default: "DevTrack — GitHub stats, streaks & global developer rankings",
    template: "%s · DevTrack",
  },
  description:
    "Track your GitHub activity, keep your coding streak alive, and see how you rank against developers worldwide. Free and open source.",
  applicationName: "DevTrack",
  // Search engine ownership checks. Google is verified by DNS.
  verification: { yandex: "cf0315371c223923" },
  openGraph: {
    type: "website",
    siteName: "DevTrack",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },

  manifest: "/manifest.json",

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  appleWebApp: {
    capable: true,
    title: "DevTrack",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const locale = await getRequestLocale();
  const messages = await getMessagesForLocale(locale);

  return (
    <html
      lang={locale}
      dir={getLocaleDirection(locale)}
      suppressHydrationWarning
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Scroll entrances start hidden and are revealed by JS; without JS, show them. */}
        <noscript
          dangerouslySetInnerHTML={{
            __html:
              "<style>[data-reveal]{opacity:1!important;transform:none!important}</style>",
          }}
        />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme');
                  const validThemes = ['classic-dark', 'modern-light-blue', 'nordic-frost', 'cyberpunk-matrix'];
                  let theme = validThemes.includes(stored || '') ? stored : null;

                  if (!theme) {
                    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    theme = systemPrefersDark ? 'classic-dark' : 'modern-light-blue';
                  }

                  const isDark = theme !== 'modern-light-blue';

                  document.documentElement.dataset.theme = theme;
                  document.documentElement.classList.toggle('dark', isDark);
                  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
                } catch (e) {}
                // The landing page's boot intro plays once per session.
                try {
                  if (sessionStorage.getItem('devtrack:booted')) {
                    document.documentElement.classList.add('booted');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>

      <body
        className={`${inter.className} ${syne.variable} ${jetbrains.variable} ${pixel.variable} min-h-screen bg-[var(--background)] text-[var(--foreground)]`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-[var(--accent-foreground)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          Skip to main content
        </a>
        <OfflineBanner />

        <div className="flex min-h-screen flex-col">
          <div className="flex-1">
            <NextIntlClientProvider locale={locale} messages={messages}>
              <Providers>
                <AppNavbar />
                <div id="main-content" tabIndex={-1} className="outline-none">
                  {children}
                </div>
                <Footer />
              </Providers>
            </NextIntlClientProvider>
          </div>

          <Toaster richColors position="top-right" />
        </div>
        <DeferredVercelMetrics
          enabled={
            process.env.VERCEL === "1" ||
            process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === "true"
          }
        />
      </body>
    </html>
  );
}
