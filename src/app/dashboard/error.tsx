"use client";

import { useEffect } from "react";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error("[Dashboard Error Boundary]", error);
  }, [error]);

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm text-center max-w-md w-full">
        <div className="mb-4 text-4xl" aria-hidden="true">
          ⚠️
        </div>
        <h2 className="text-xl font-semibold text-[var(--card-foreground)] mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          The dashboard ran into an unexpected error. Your data is safe — this
          is just a display issue.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2"
          aria-label="Try loading the dashboard again"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
