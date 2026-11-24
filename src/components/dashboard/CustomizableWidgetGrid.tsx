"use client";

import { useState, useEffect } from "react";
import { GripVertical, RotateCcw } from "lucide-react";
import TodayFocusHero from "@/components/TodayFocusHero";
import {
  AIMentor,
  ContributionGraph,
  PersonalRecords,
} from "@/components/dashboard/widgets";
import {
  DEFAULT_WIDGET_ORDER,
  WidgetId,
  WIDGET_LABELS,
  loadWidgetOrder,
  saveWidgetOrder,
  resetWidgetOrder,
  reorderWidgets,
} from "@/lib/widget-layout";

export default function CustomizableWidgetGrid() {
  const [order, setOrder] = useState<WidgetId[]>([...DEFAULT_WIDGET_ORDER]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);

  useEffect(() => {
    setOrder(loadWidgetOrder());
  }, []);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = reorderWidgets(order, draggedIndex, index);
    setOrder(newOrder);
    setDraggedIndex(index);
    saveWidgetOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleReset = () => {
    const defaultOrder = resetWidgetOrder();
    setOrder(defaultOrder);
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

  return (
    <div className="space-y-4">
      {/* Layout Toolbar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <button
          onClick={() => setIsCustomizing((prev) => !prev)}
          className="inline-flex items-center gap-1.5 font-medium hover:text-white transition-colors"
        >
          <GripVertical className="w-3.5 h-3.5" />
          {isCustomizing ? "Done Reordering" : "Customize Widget Layout"}
        </button>

        {isCustomizing && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset Layout
          </button>
        )}
      </div>

      {/* Widget Grid */}
      <div className="grid gap-4 xl:grid-cols-2">
        {order.map((widgetId, index) => (
          <div
            key={widgetId}
            draggable={isCustomizing}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`transition-all duration-200 relative ${
              isCustomizing
                ? "cursor-grab active:cursor-grabbing border-2 border-dashed border-indigo-500/40 rounded-2xl p-2 bg-slate-900/40"
                : ""
            } ${draggedIndex === index ? "opacity-50 scale-95" : "opacity-100"}`}
          >
            {isCustomizing && (
              <div className="flex items-center justify-between mb-2 text-xs font-semibold text-indigo-400 px-2 py-1 bg-slate-950/80 rounded-lg">
                <span className="flex items-center gap-1">
                  <GripVertical className="w-3.5 h-3.5" />
                  {WIDGET_LABELS[widgetId]}
                </span>
                <span className="text-[10px] text-slate-500">Drag to reorder</span>
              </div>
            )}
            {renderWidget(widgetId)}
          </div>
        ))}
      </div>
    </div>
  );
}
