import Link from "@/components/Link";
import { ArrowRight, Sparkles } from "lucide-react";

/** Slim banner that puts Year in Code (Wrapped) in front of every visit. */
export default function WrappedSpotlight() {
  const year = new Date().getFullYear();
  return (
    <Link
      href="/wrapped"
      className="group flex items-center gap-3 rounded-xl border border-[var(--accent)]/30 bg-gradient-to-r from-[var(--accent)]/15 via-[var(--accent-secondary)]/10 to-transparent px-4 py-3 transition-colors hover:border-[var(--accent)]/60"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/20 text-[var(--accent)]">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--foreground)]">
          Your {year} Year in Code is ready
        </span>
        <span className="block truncate text-xs text-[var(--muted-foreground)]">
          Your year of commits, languages and streaks as a story you can share.
        </span>
      </span>
      <span className="hidden items-center gap-1 text-sm font-medium text-[var(--accent)] sm:flex">
        View
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
