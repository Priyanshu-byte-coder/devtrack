"use client";

import React, { useState } from "react";

export interface MetricTooltipProps {
  content: string;
  label?: string;
  className?: string;
}

export default function MetricTooltip({
  content,
  label = "More information",
  className = "",
}: MetricTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        onBlur={() => setIsOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--card-muted)] text-[9px] font-bold text-[var(--muted-foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] transition-colors cursor-help"
      >
        ?
      </button>

      <span
        role="tooltip"
        className={`absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 w-48 sm:w-56 rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-normal leading-normal text-[var(--card-foreground)] shadow-lg z-30 transition-all pointer-events-none text-left ${
          isOpen
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100"
        }`}
      >
        {content}
        <span
          className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-t-[var(--card)] border-transparent"
          aria-hidden="true"
        />
      </span>
    </span>
  );
}
