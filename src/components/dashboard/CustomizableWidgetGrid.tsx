"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, GripVertical, RotateCcw, Sliders } from "lucide-react";
import TodayFocusHero from "@/components/TodayFocusHero";
import {
  AIMentor,
  ContributionGraph,
  PersonalRecords,
} from "@/components/dashboard/widgets";
import {
  DEFAULT_LAYOUT,
  DashboardLayout,
  WidgetId,
  WIDGET_LABELS,
  loadWidgetLayout,
  saveWidgetLayout,
  resetWidgetLayout,
  reorderWidgets,
  moveWidget,
} from "@/lib/widget-layout";

export default function CustomizableWidgetGrid() {
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [dragged, setDragged] = useState<{
    column: "main" | "side";
    index: number;
  } | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);

  useEffect(() => {
    setLayout(loadWidgetLayout());
  }, []);

  const handleDragStart = (column: "main" | "side", index: number) => {
    setDragged({ column, index });
  };

  const handleDragOver = (
    e: React.DragEvent,
    column: "main" | "side",
    targetIndex: number
  ) => {
    e.preventDefault();
    if (!dragged || dragged.column !== column || dragged.index === targetIndex) {
      return;
    }

    const currentList = layout[column];
    const updatedList = reorderWidgets(currentList, dragged.index, targetIndex);
    const newLayout = { ...layout, [column]: updatedList };

    setLayout(newLayout);
    setDragged({ column, index: targetIndex });
    saveWidgetLayout(newLayout);
  };

  const handleDragEnd = () => {
    setDragged(null);
  };

  const handleMove = (
    column: "main" | "side",
    index: number,
    direction: "up" | "down"
  ) => {
    const currentList = layout[column];
    const updatedList = moveWidget(currentList, index, direction);
    const newLayout = { ...layout, [column]: updatedList };

    setLayout(newLayout);
    saveWidgetLayout(newLayout);
  };

  const handleReset = () => {
    const defaultLayout = resetWidgetLayout();
    setLayout(defaultLayout);
  };

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case "activity":
        return (
          <div className="min-h-[388px] sm:min-h-[330px]" data-tour="activity">
            <ContributionGraph />
          </div>
        );
      case "records":
        return <PersonalRecords />;
      case "focus":
        return (
          <div data-tour="focus">
            <TodayFocusHero />
          </div>
        );
      case "mentor":
        return <AIMentor />;
      default:
        return null;
    }
  };

  const renderWidgetContainer = (
    widgetId: WidgetId,
    index: number,
    column: "main" | "side"
  ) => {
    const list = layout[column];
    const isFirst = index === 0;
    const isLast = index === list.length - 1;
    const isBeingDragged =
      dragged?.column === column && dragged?.index === index;

    return (
      <div
        key={widgetId}
        draggable={isCustomizing}
        onDragStart={() => handleDragStart(column, index)}
        onDragOver={(e) => handleDragOver(e, column, index)}
        onDragEnd={handleDragEnd}
        className={`transition-all duration-200 relative ${
          isCustomizing
            ? "border-2 border-dashed border-accent/40 rounded-xl p-2 bg-[var(--card)] shadow-sm"
            : ""
        } ${isBeingDragged ? "opacity-50 scale-95" : "opacity-100"}`}
      >
        {isCustomizing && (
          <div className="flex items-center justify-between mb-2 text-xs font-medium text-accent px-2 py-1.5 bg-accent/10 rounded-lg">
            <span className="flex items-center gap-1.5 font-semibold">
              <GripVertical className="w-3.5 h-3.5 cursor-grab active:cursor-grabbing text-accent" />
              {WIDGET_LABELS[widgetId]}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleMove(column, index, "up")}
                disabled={isFirst}
                aria-label={`Move ${WIDGET_LABELS[widgetId]} up`}
                className="p-1 rounded hover:bg-accent/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Move up"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMove(column, index, "down")}
                disabled={isLast}
                aria-label={`Move ${WIDGET_LABELS[widgetId]} down`}
                className="p-1 rounded hover:bg-accent/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Move down"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        {renderWidget(widgetId)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Layout Toolbar */}
      <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] px-1">
        <button
          type="button"
          onClick={() => setIsCustomizing((prev) => !prev)}
          className="inline-flex items-center gap-1.5 font-medium hover:text-[var(--accent)] transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
          {isCustomizing ? "Done Reordering" : "Customize Widget Layout"}
        </button>

        {isCustomizing && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 font-medium text-[var(--accent)] hover:underline transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset Layout
          </button>
        )}
      </div>

      {/* Widget Grid with 2/3 + 1/3 split */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          {layout.main.map((widgetId, index) =>
            renderWidgetContainer(widgetId, index, "main")
          )}
        </div>
        <div className="min-w-0 space-y-4">
          {layout.side.map((widgetId, index) =>
            renderWidgetContainer(widgetId, index, "side")
          )}
        </div>
      </div>
    </div>
  );
}
