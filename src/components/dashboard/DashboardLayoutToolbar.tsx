"use client";

import { Check, Eye, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  DASHBOARD_WIDGET_LABELS,
  type DashboardWidgetId,
} from "@/lib/dashboard-layout";

interface DashboardLayoutToolbarProps {
  isEditing: boolean;
  hiddenWidgets: DashboardWidgetId[];
  onEditingChange: (isEditing: boolean) => void;
  onReset: () => void;
  onShowWidget: (widgetId: DashboardWidgetId) => void;
}

export default function DashboardLayoutToolbar({
  isEditing,
  hiddenWidgets,
  onEditingChange,
  onReset,
  onShowWidget,
}: DashboardLayoutToolbarProps) {
  return (
    <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)]/50 backdrop-blur-sm p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
            Customize Your Dashboard
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Reorder widgets by dragging, hide cards you don&apos;t need, and reset to default anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {isEditing ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-all hover:bg-[var(--card)]/80 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] active:scale-95"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset Layout
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onEditingChange(!isEditing)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--accent)] transition-all hover:bg-[var(--accent)]/20 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] active:scale-95"
          >
            {isEditing ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Done Editing
              </>
            ) : (
              <>
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Edit Layout
              </>
            )}
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-6 border-t border-[var(--border)] pt-6 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Hidden Widgets ({hiddenWidgets.length})
          </h3>

          {hiddenWidgets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {hiddenWidgets.map((widgetId) => (
                <button
                  key={widgetId}
                  type="button"
                  onClick={() => onShowWidget(widgetId)}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/70 px-3 py-2 text-xs font-medium text-[var(--foreground)] transition-all hover:bg-[var(--accent)]/20 hover:border-[var(--accent)]/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] active:scale-95"
                  title={`Click to show ${DASHBOARD_WIDGET_LABELS[widgetId]}`}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  Show {DASHBOARD_WIDGET_LABELS[widgetId]}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)] bg-[var(--card)]/30 rounded-lg px-3 py-2 italic">
              ✓ All widgets are visible. No hidden widgets to restore.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}