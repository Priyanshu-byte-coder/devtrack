"use client";

import { useEffect } from "react";
import Link from "next/link";

import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log locally and report to Sentry in production
    console.error("[DevTrack] Application error:", error);
    if (process.env.NODE_ENV === "production") {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 text-center">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-soft)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-10 w-10 text-[var(--accent)]"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Branding */}
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
          DevTrack · 500
        </p>

        <h1 className="mb-2 text-2xl font-bold text-[var(--card-foreground)]">
          Something went wrong
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-[var(--muted-foreground)]">
          An unexpected server error occurred. Our team has been notified. You
          can try again or head back to the dashboard.
        </p>

        {/* Error digest for support */}
        {error.digest && (
          <p className="mb-6 text-xs text-[var(--muted-foreground)]">
            Error ID:{" "}
            <code className="rounded bg-[var(--control)] px-1.5 py-0.5 font-mono text-[var(--card-foreground)]">
              {error.digest}
            </code>
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--card-foreground)] transition-all hover:bg-[var(--control)] active:scale-[0.98]"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}