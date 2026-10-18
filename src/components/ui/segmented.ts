import { cn } from "@/lib/utils";

/** Shared look for small tab/toggle groups (period pickers, view tabs). */
export const segmentedGroupClass =
  "inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-0.5";

export function segmentedItemClass(active: boolean, className?: string) {
  return cn(
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    active
      ? "bg-[var(--control)] text-[var(--foreground)] shadow-sm"
      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
    className
  );
}
