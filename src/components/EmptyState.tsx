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
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="text-6xl mb-6 select-none" role="img" aria-label={title}>
        {icon}
      </div>
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">
        {title}
      </h2>
      <p className="text-[var(--muted-foreground)] max-w-sm mb-8 leading-relaxed">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium text-sm hover:opacity-80 transition-opacity"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}