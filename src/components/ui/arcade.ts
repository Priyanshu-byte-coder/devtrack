import { cn } from "@/lib/utils";

/**
 * Arcade versions of small shared controls. Pair with the .px-* classes in
 * globals.css. Tabs read like a game menu: pixel caps, and the selected one
 * sits in a notched frame.
 */
export const arcadeTabGroupClass = "inline-flex flex-wrap items-center gap-1";

export function arcadeTabClass(active: boolean, className?: string) {
  return cn(
    "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 font-pixel text-xs uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
    active
      ? "px-frame px-frame-accent bg-[var(--card)] text-[var(--accent)]"
      : "m-1 text-[var(--muted-foreground)] hover:bg-[var(--control)] hover:text-[var(--foreground)]",
    className
  );
}

/** Uppercase pixel label above a value, as in a game HUD. */
export const hudLabelClass =
  "font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]";
