"use client";

import type { CSSProperties, ReactNode } from "react";
import { GripVertical, EyeOff } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DashboardWidgetId } from "@/lib/dashboard-layout";
import DashboardWidgetShell from "@/components/dashboard/DashboardWidgetShell";

interface SortableDashboardWidgetProps {
  id: DashboardWidgetId;
  title: string;
  isEditing: boolean;
  onHide: (widgetId: DashboardWidgetId) => void;
  children: ReactNode;
  className?: string;
}

export default function SortableDashboardWidget({
  id,
  title,
  isEditing,
  onHide,
  children,
  className = "",
}: SortableDashboardWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !isEditing,
    resizeObserverConfig: {},
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative min-w-0 ${className} ${
        isDragging ? "opacity-60 scale-95" : ""
      } transition-all duration-150`}
    >
      {isEditing ? (
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Drag widget: ${title}`}
            title={`Drag to reorder ${title}`}
            className="touch-none rounded-lg border border-[var(--border)] bg-[var(--card)]/95 p-2 text-[var(--muted-foreground)] shadow-sm backdrop-blur transition-all hover:text-[var(--foreground)] hover:shadow-md hover:border-[var(--accent)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label={`Hide widget: ${title}`}
            title={`Hide ${title}`}
            onClick={() => onHide(id)}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)]/95 p-2 text-[var(--muted-foreground)] shadow-sm backdrop-blur transition-all hover:text-red-500 hover:shadow-md hover:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div
        className={
          isEditing
            ? "rounded-xl outline outline-2 outline-dashed outline-[var(--accent)]/40 outline-offset-2 transition-all"
            : "transition-shadow duration-200 hover:shadow-lg"
        }
      >
        <DashboardWidgetShell
          widgetId={id}
          title={title}
          isEditing={isEditing}
        >
          {children}
        </DashboardWidgetShell>
      </div>
    </div>
  );
}