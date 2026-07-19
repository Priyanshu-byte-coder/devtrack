import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 text-center">
      <div className="w-full max-w-lg">
        {/* Branding */}
        <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-[var(--accent)]">
          DevTrack
        </p>

        {/* 404 number */}
        <div className="relative inline-block">
          <h1 className="text-[10rem] font-extrabold leading-none tracking-tight text-[var(--accent)] opacity-20 select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-[var(--accent-soft)] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
              Page Not Found
            </span>
          </div>
        </div>

        {/* Message */}
        <h2 className="mt-4 text-2xl font-bold text-[var(--card-foreground)] md:text-3xl">
          Oops! This page doesn&apos;t exist.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
          The page you&apos;re looking for may have been moved, renamed, or
          never existed. Let&apos;s get you back on track.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--accent-foreground)] shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Go Back to Dashboard
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-6 py-3 text-sm font-semibold text-[var(--card-foreground)] transition-all hover:bg-[var(--control)] active:scale-[0.98]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}