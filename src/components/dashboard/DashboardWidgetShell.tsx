"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useRef } from "react";
import type { DashboardWidgetId } from "@/lib/dashboard-layout";
import { useDashboardWidgetA11yState } from "@/components/dashboard/DashboardWidgetA11yContext";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DashboardWidgetShellProps {
  widgetId: DashboardWidgetId;
  title: string;
  isEditing: boolean;
  children: ReactNode;
}

export default function DashboardWidgetShell({
  widgetId,
  title,
  isEditing,
  children,
}: DashboardWidgetShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const titleId = `${widgetId}-title`;
  const summaryId = `${widgetId}-summary`;
  const { summary, isUpdating } = useDashboardWidgetA11yState(widgetId);

  const focusFirstControl = () => {
    const root = shellRef.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isEditing) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    focusFirstControl();
  };

  return (
    <div
      ref={shellRef}
      role="region"
      tabIndex={isEditing ? -1 : 0}
      aria-labelledby={titleId}
      aria-describedby={summary ? summaryId : undefined}
      aria-busy={isUpdating || undefined}
      onKeyDown={handleKeyDown}
      className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
    >
      <h3 id={titleId} className="sr-only">
        {title}
      </h3>

      {summary ? (
        <p
          id={summaryId}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {summary}
        </p>
      ) : null}

      {children}
    </div>
  );
}
