"use client";

import { useEffect, useState } from "react";

/**
 * Pixel dots under a horizontal swipe row (phones only): they follow the
 * card in view, and tapping one scrolls to that card. `targetId` is the
 * scrolling element; each of its children is one card.
 */
export default function SwipeDots({
  targetId,
  count,
  label,
  className = "md:hidden",
}: {
  targetId: string;
  count: number;
  label: string;
  /** Hides the dots where the row stops swiping. */
  className?: string;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const row = document.getElementById(targetId);
    if (!row) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = row.scrollWidth - row.clientWidth;
        if (max <= 0) return setActive(0);
        setActive(Math.round((row.scrollLeft / max) * (count - 1)));
      });
    };
    row.addEventListener("scroll", update, { passive: true });
    return () => {
      row.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, [targetId, count]);

  const go = (i: number) => {
    const card = document.getElementById(targetId)?.children[i];
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    card?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "nearest",
      inline: "center",
    });
  };

  return (
    <div
      className={`mt-4 flex items-center justify-center gap-2 ${className}`}
      role="group"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => go(i)}
          aria-label={`Show card ${i + 1} of ${count}`}
          aria-current={i === active ? "true" : undefined}
          // A 32 px tap area around a small pixel dot.
          className="flex h-8 items-center justify-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <span
            className={`block h-2 transition-[width] duration-150 ${
              i === active ? "w-5 bg-[var(--accent)]" : "w-2 bg-[var(--border)]"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
