"use client";

import { useMemo } from "react";
import {
  buildHeatmap,
  buildMonthMarkers,
  countInRangeCommits,
  formatCellTooltip,
  formatCommitCount,
  HEATMAP_CELL_GAP,
  HEATMAP_CELL_SIZE,
  HEATMAP_DAY_LABELS,
  HEATMAP_HEADER_HEIGHT,
  HEATMAP_LABEL_WIDTH,
  HEATMAP_LEGEND_COUNTS,
} from "@/lib/contribution-heatmap";
import {
  getHeatmapCellStyle,
  type HeatmapThemeConfig,
} from "@/hooks/useHeatmapTheme";

export interface ContributionHeatmapCalendarProps {
  data: Record<string, number>;
  days?: number;
  fromDate?: string;
  toDate?: string;
  themeConfig: HeatmapThemeConfig;
  onCellClick?: (dateKey: string) => void;
  loading?: boolean;
  className?: string;
  showLegend?: boolean;
}

export default function ContributionHeatmapCalendar({
  data,
  days = 365,
  fromDate,
  toDate,
  themeConfig,
  onCellClick,
  loading = false,
  className = "",
  showLegend = true,
}: ContributionHeatmapCalendarProps) {
  const displayDays = useMemo(() => {
    if (fromDate && toDate) {
      const msPerDay = 1000 * 60 * 60 * 24;
      return (
        Math.ceil(
          (new Date(toDate).getTime() - new Date(fromDate).getTime()) / msPerDay
        ) + 1
      );
    }
    return days;
  }, [days, fromDate, toDate]);

  const cells = useMemo(
    () => buildHeatmap(displayDays, data, fromDate, toDate),
    [displayDays, data, fromDate, toDate]
  );

  const weekCount = Math.ceil(cells.length / 7);
  const monthMarkers = useMemo(
    () => buildMonthMarkers(cells, weekCount),
    [cells, weekCount]
  );

  const totalGridWidth =
    HEATMAP_LABEL_WIDTH + weekCount * HEATMAP_CELL_SIZE + (weekCount - 1) * HEATMAP_CELL_GAP;

  const gridStyle = {
    gridTemplateColumns: `${HEATMAP_LABEL_WIDTH}px repeat(${weekCount}, ${HEATMAP_CELL_SIZE}px)`,
    gridTemplateRows: `repeat(7, ${HEATMAP_CELL_SIZE}px)`,
    columnGap: `${HEATMAP_CELL_GAP}px`,
    rowGap: `${HEATMAP_CELL_GAP}px`,
  } as const;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const totalCommits = countInRangeCommits(cells);
  const heatmapSummary = `Contribution heatmap showing ${formatCommitCount(totalCommits)} across ${displayDays} days.`;

  if (loading) {
    return (
      <div
        className={`h-[300px] animate-pulse rounded-lg bg-[var(--card-muted)] ${className}`}
        aria-busy="true"
        aria-label="Loading contribution heatmap"
      />
    );
  }

  return (
    <div className={className}>
      <div
        className="overflow-x-auto pb-2 scrollbar-thin"
        role="img"
        aria-label={heatmapSummary}
      >
        <div
          className="mx-auto flex flex-col gap-1"
          style={{ width: `${totalGridWidth}px` }}
        >
          <div
            className="relative w-full text-[11px] font-semibold text-[var(--foreground)] dark:text-gray-200"
            style={{ height: `${HEATMAP_HEADER_HEIGHT}px` }}
          >
            {monthMarkers.map((marker, idx) => {
              const absoluteLeftOffset =
                HEATMAP_LABEL_WIDTH + marker.weekIndex * (HEATMAP_CELL_SIZE + HEATMAP_CELL_GAP);
              const nextMarker = monthMarkers[idx + 1];
              const nextOffset = nextMarker
                ? HEATMAP_LABEL_WIDTH +
                  nextMarker.weekIndex * (HEATMAP_CELL_SIZE + HEATMAP_CELL_GAP)
                : totalGridWidth;
              const availableWidth = nextOffset - absoluteLeftOffset - 8;

              return (
                <div
                  key={`${marker.label}-${marker.weekIndex}`}
                  className="absolute top-0 truncate font-semibold"
                  style={{
                    left: `${absoluteLeftOffset}px`,
                    width: `${Math.max(0, availableWidth)}px`,
                    paddingRight: "4px",
                  }}
                  title={marker.label}
                >
                  {marker.label}
                </div>
              );
            })}
          </div>

          <div className="grid items-center" style={gridStyle}>
            {HEATMAP_DAY_LABELS.map((label, rowIndex) => (
              <div
                key={label}
                className="flex items-center justify-end pr-2 text-[10px] text-[var(--muted-foreground)] dark:text-gray-500"
                style={{
                  gridRow: rowIndex + 1,
                  gridColumn: 1,
                  opacity: rowIndex % 2 === 0 ? 1 : 0,
                }}
              >
                {rowIndex % 2 === 0 ? label : ""}
              </div>
            ))}

            {cells.map((cell, index) => {
              const weekIndex = Math.floor(index / 7);
              const dayIndex = index % 7;
              const isFuture = cell.date > today;
              const showTooltipBelow = dayIndex < 2;
              const isNearRightEdge = weekIndex >= weekCount - 3;
              const cellStyle = getHeatmapCellStyle(cell.count, themeConfig);
              const tooltip = formatCellTooltip(cell.count, cell.date);
              const accessibleLabel = `${formatCommitCount(cell.count)} on ${cell.dateKey}`;
              const isInteractive = !isFuture && Boolean(onCellClick);

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  title={isFuture ? "" : tooltip}
                  aria-label={isFuture ? `Future date on ${cell.dateKey}` : accessibleLabel}
                  disabled={isFuture}
                  onClick={() => {
                    if (!isFuture && onCellClick) onCellClick(cell.dateKey);
                  }}
                  className={`group relative z-0 h-4 w-4 rounded-[3px] border transition-transform hover:z-20 hover:scale-110 focus:z-20 focus-visible:ring-2 focus-visible:ring-[var(--heatmap-focus-ring)] disabled:cursor-default disabled:opacity-20 ${
                    cell.inRange ? "opacity-100" : "opacity-40"
                  } ${isInteractive ? "cursor-pointer" : "cursor-default"}`}
                  style={{
                    gridRow: dayIndex + 1,
                    gridColumn: weekIndex + 2,
                    backgroundColor: isFuture ? "transparent" : cellStyle.backgroundColor,
                    borderColor: themeConfig.border,
                    ["--heatmap-focus-ring" as string]: themeConfig.accent,
                  }}
                >
                  {!isFuture && (
                    <span
                      className={`pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-[var(--foreground)] px-2 py-1 text-[11px] text-[var(--background)] shadow-lg group-hover:block group-focus:block ${
                        showTooltipBelow ? "top-full mt-2" : "bottom-full mb-2"
                      } ${
                        isNearRightEdge
                          ? "right-0 translate-x-0"
                          : "left-1/2 -translate-x-1/2"
                      }`}
                    >
                      {tooltip}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showLegend && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="dark:text-gray-300">Less</span>
          <div className="flex items-center gap-1">
            {HEATMAP_LEGEND_COUNTS.map((count) => {
              const swatch = getHeatmapCellStyle(count, themeConfig);
              return (
                <span
                  key={count}
                  className="h-3 w-3 rounded-sm border"
                  style={{
                    backgroundColor: swatch.backgroundColor,
                    borderColor: themeConfig.border,
                  }}
                />
              );
            })}
          </div>
          <span className="dark:text-gray-300">More</span>
        </div>
      )}
    </div>
  );
}
