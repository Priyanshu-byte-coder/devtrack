"use client";

import type { ReactNode } from "react";
import { useDashboardWidgetA11yState } from "@/components/dashboard/DashboardWidgetA11yContext";

/**
 * Landmark around one dashboard widget: a labelled region that announces the
 * widget's live summary and marks itself busy while it refreshes.
 */
export default function WidgetRegion({
  widgetId,
  title,
  children,
}: {
  widgetId: string;
  title: string;
  children: ReactNode;
}) {
  const titleId = `${widgetId}-title`;
  const summaryId = `${widgetId}-summary`;
  const { summary, isUpdating } = useDashboardWidgetA11yState(widgetId);

  return (
    <div
      role="region"
      aria-labelledby={titleId}
      aria-describedby={summary ? summaryId : undefined}
      aria-busy={isUpdating || undefined}
      className="min-w-0"
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
