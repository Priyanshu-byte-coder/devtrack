import Link from "next/link";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export default function EmptyState({
  icon = "🏆",
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 backdrop-blur-xs shadow-xs my-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-3xl mb-5 select-none shadow-xs border border-[var(--accent)]/20" role="img" aria-label={title}>
        {icon}
      </div>
      <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)] mb-2">
        {title}
      </h2>
      <p className="text-sm text-[var(--muted-foreground)] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold text-sm shadow-xs hover:bg-[var(--accent)]/90 hover:shadow-sm transition-all active:scale-[0.98]"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}