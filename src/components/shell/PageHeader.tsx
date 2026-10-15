import type { ReactNode } from "react";

/** Title row shared by every dashboard tab. */
export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** Section heading inside a tab, used to group related widgets. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] first:mt-0">
      {children}
    </h2>
  );
}
