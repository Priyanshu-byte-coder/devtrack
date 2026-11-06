"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface SettingsNavItem {
  id: string;
  label: string;
}

/**
 * The settings page as a game options menu: a sticky list on wide screens
 * (a scrolling row on narrow ones) with a ▶ cursor on the section in view.
 */
export default function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visible.delete(entry.target.id);
          }
        }
        // The topmost section still on screen is the one being read.
        const first = items.find((item) => visible.has(item.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-80px 0px -55% 0px" }
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label="Settings sections"
      className="-mx-1 mb-6 overflow-x-auto lg:sticky lg:top-24 lg:mx-0 lg:mb-0 lg:self-start lg:overflow-visible"
    >
      <p className="mb-3 hidden font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)] lg:block">
        Options
      </p>
      <ul className="flex gap-1 px-1 lg:flex-col lg:gap-0.5 lg:px-0">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={() => setActive(item.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap px-2 py-1.5 font-pixel text-[11px] uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  isActive
                    ? "bg-[var(--control)] text-[var(--accent)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "hidden w-2 lg:inline",
                    isActive ? "px-blink" : "invisible"
                  )}
                >
                  ▶
                </span>
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
