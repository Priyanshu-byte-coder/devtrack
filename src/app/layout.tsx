import CustomCursor from "@/components/CustomCursor";
import type { Metadata, Viewport } from "next";
import { Inter, Syne, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://devtrack.vercel.app"),
  title: "DevTrack — Developer Productivity Dashboard",
  description:
    "Track coding habits, visualize GitHub contributions, and hit your goals.",

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
  const locale = await getRequestLocale();
  const messages = await getMessagesForLocale(locale);

  return (
    <html lang={locale} dir={getLocaleDirection(locale)} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <script
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
              })();
            `,
          }}
        />
      </head>

      <body
        className={`${inter.className} min-h-screen bg-[var(--background)] text-[var(--foreground)]`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-[var(--accent-foreground)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          Skip to main content
        </a>
        <CustomCursor />
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
        <DeferredVercelMetrics />
      </body>
    </html>
  );
}
