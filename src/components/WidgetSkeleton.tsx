import React from "react";

interface WidgetSkeletonProps {
  children?: React.ReactNode;
  className?: string;
  title?: string;
}

export default function WidgetSkeleton({
  children,
  className = "",
  title,
}: WidgetSkeletonProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading {title || "widget"}...</span>
      {children}
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded ${className}`} />;
}
