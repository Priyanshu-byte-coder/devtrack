"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Silkscreen } from "next/font/google";
import "./globals.css";

const pixel = Silkscreen({
  subsets: ["latin"],
  variable: "--font-pixel",
  weight: ["400", "700"],
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Pixel Fallback", "ui-monospace", "monospace"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);

    // Restore the saved theme because the root layout is unavailable.
    try {
      const validThemes = [
        "classic-dark",
        "modern-light-blue",
        "nordic-frost",
        "cyberpunk-matrix",
      ];

      const storedTheme = localStorage.getItem("theme");

      const theme = validThemes.includes(storedTheme || "")
        ? storedTheme!
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "classic-dark"
          : "modern-light-blue";

      const isDark = theme !== "modern-light-blue";

      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    } catch {
      // Keep the default CSS theme if localStorage is unavailable.
    }
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${pixel.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
          {/* Decorative arcade background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(var(--accent) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          <div className="relative z-10 w-full max-w-xl text-center">
            {/* System status */}
            <div
              role="status"
              className="mb-8 inline-flex items-center gap-2 border border-border bg-card px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 animate-pulse bg-destructive"
              />
              System failure detected
            </div>

            {/* Arcade heading */}
            <div className="mb-8">
              <p className="mb-4 font-mono text-sm font-semibold uppercase tracking-[0.3em] text-accent">
                DevTrack // Critical Error
              </p>

              <h1 className="font-pixel text-4xl leading-tight text-foreground sm:text-5xl md:text-6xl">
                GAME
                <span className="mt-3 block text-destructive">OVER</span>
              </h1>
            </div>

            {/* Error message card */}
            <section
              aria-labelledby="error-title"
              className="border border-border bg-card p-6 shadow-[var(--shadow-medium)] sm:p-8"
            >
              <div
                aria-hidden="true"
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border-2 border-destructive bg-destructive-muted font-pixel text-3xl text-destructive"
              >
                !
              </div>

              <h2
                id="error-title"
                className="mb-3 font-display text-xl font-bold sm:text-2xl"
              >
                Oops! Something broke.
              </h2>

              <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-base">
                Looks like our system encountered an unexpected error. Do not
                worry, your next run is just one click away.
              </p>

              {/* Recovery actions */}
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 border border-accent bg-accent px-7 py-3 font-mono text-sm font-bold uppercase tracking-wider text-accent-foreground transition-opacity duration-200 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:w-auto"
                >
                  <span aria-hidden="true">↻</span>
                  Try again
                </button>

                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full reload after a crash */}
                <a
                  href="/"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 border border-border bg-muted px-7 py-3 font-mono text-sm font-bold uppercase tracking-wider text-foreground transition-colors duration-200 hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:w-auto"
                >
                  <span aria-hidden="true">⌂</span>
                  Home
                </a>
              </div>
            </section>

            {/* Arcade footer */}
            <p className="mt-8 font-mono text-xs tracking-widest text-muted-foreground">
              INSERT COIN TO CONTINUE
            </p>

            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              DEVTRACK © {new Date().getFullYear()} {"// ERROR 500"}
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
