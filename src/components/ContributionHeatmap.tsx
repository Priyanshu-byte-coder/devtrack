"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHeatmapTheme } from "@/hooks/useHeatmapTheme";
import DailyBreakdownSheet from "@/components/DailyBreakdownSheet";
import { getContributionInsights } from "@/lib/contribution-insights";
import { Calendar, TrendingUp, Zap, Clock, Award, BarChart2 } from "lucide-react";
import { useLastUpdated } from "@/hooks/useLastUpdated";
import LastUpdatedTimestamp from "@/components/LastUpdatedTimestamp";

interface ContributionHeatmapProps {
  days?: number;
}

interface ContributionResponse {
  data: Record<string, number>;
}

interface HeatmapCell {
  date: Date;
  dateKey: string;
  count: number;
  inRange: boolean;
}

const DEFAULT_DAYS = 365;
const CELL_SIZE = 14;
const CELL_GAP = 3;
const LABEL_WIDTH = 48;
const HEADER_HEIGHT = 20;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PRESET_RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "6mo", days: 180 },
  { label: "1yr", days: 365 },
] as const;

// Memoized formatting engine to avoid recreation garbage collection cycles inside render loops
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCommitCount(count: number) {
  return `${count} commit${count === 1 ? "" : "s"}`;
}

function buildHeatmap(days: number, contributions: Record<string, number>, fromDate?: string, toDate?: string) {
  let endDate: Date;
  let startDate: Date;

  if (fromDate && toDate) {
    // Use provided custom date range
    endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);
    startDate = new Date(fromDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Calculate from N days ago until today
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);
  }

  const firstWeekStart = new Date(startDate);
  firstWeekStart.setDate(startDate.getDate() - startDate.getDay());
  firstWeekStart.setHours(0, 0, 0, 0);

  const lastWeekEnd = new Date(endDate);
  lastWeekEnd.setDate(endDate.getDate() + (6 - endDate.getDay()));
  lastWeekEnd.setHours(23, 59, 59, 999);

  const cells: HeatmapCell[] = [];
  const cursor = new Date(firstWeekStart);

  while (cursor <= lastWeekEnd) {
    const dateKey = formatDateKey(cursor);
    cells.push({
      date: new Date(cursor),
      dateKey,
      count: contributions[dateKey] ?? 0,
      inRange: cursor >= startDate && cursor <= endDate,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

export default function ContributionHeatmap({
  days = DEFAULT_DAYS,
}: ContributionHeatmapProps) {
  const [data, setData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastUpdated, setLastUpdated, relativeLabel } = useLastUpdated();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const handleCloseSheet = useCallback(() => setSelectedDate(null), []);

  // Range state
  const [selectedDays, setSelectedDays] = useState(days);
  const [showPopover, setShowPopover] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load persisted range preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("devtrack:heatmap-range");
        if (stored === "30" || stored === "90" || stored === "180" || stored === "365") {
          setSelectedDays(Number(stored));
        } else {
          localStorage.setItem("devtrack:heatmap-range", String(days));
        }
      } catch (e) {
        setSelectedDays(days);
      }
    }
  }, [days]);

  // Handle popover dismiss
  useEffect(() => {
    if (!showPopover) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPopover(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showPopover]);

  const handleRangeChange = (newDays: number) => {
    setSelectedDays(newDays);
    setCustomLabel(null);
    setCustomFrom("");
    setCustomTo("");
    setCustomError(null);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("devtrack:heatmap-range", String(newDays));
      } catch (e) {}
    }
  };

  const handleCustomApply = () => {
    setCustomError(null);
    const today = new Date().toISOString().slice(0, 10);

    if (!customFrom || !customTo) {
      setCustomError("Please select both dates.");
      return;
    }
    if (customFrom > customTo) {
      setCustomError("Start date must be before end date.");
      return;
    }
    if (customTo > today) {
      setCustomError("End date can't be in the future.");
      return;
    }
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff =
      (new Date(customTo).getTime() - new Date(customFrom).getTime()) / msPerDay;
    if (diff > 365 * 2) {
      setCustomError("Max range is 2 years.");
      return;
    }

    const fmt = (d: string) => {
      const [year, month, day] = d.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    };
    setCustomLabel(`${fmt(customFrom)} - ${fmt(customTo)}`);
    setShowPopover(false);
  };

  const currentFrom = customLabel ? customFrom : (() => {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (selectedDays - 1));
    return formatDateKey(startDate);
  })();

  const currentTo = customLabel ? customTo : formatDateKey(new Date());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("from", currentFrom);
    params.set("to", currentTo);
    
    fetch(`/api/metrics/contributions?${params.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error("API error");
        return response.json();
      })
      .then((result: ContributionResponse) => {
        if (!active) return;
        setData(result.data ?? {});
        setLastUpdated(new Date());
        
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load contribution heatmap.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentFrom, currentTo]);

  

  const { themeConfig, theme, setTheme } = useHeatmapTheme();
  
  const displayDays = useMemo(() => {
    if (customLabel && customFrom && customTo) {
      const msPerDay = 1000 * 60 * 60 * 24;
      return Math.ceil(
        (new Date(customTo).getTime() - new Date(customFrom).getTime()) / msPerDay
      ) + 1;
    }
    return selectedDays;
  }, [customLabel, customFrom, customTo, selectedDays]);
  
  const cells = useMemo(
    () => buildHeatmap(
      displayDays, 
      data,
      customLabel ? customFrom : undefined,
      customLabel ? customTo : undefined
    ),
    [displayDays, data, customLabel, customFrom, customTo]
  );
  const weekCount = Math.ceil(cells.length / 7);
  const maxCommits = Math.max(
    ...cells.map((cell) => cell.count),
    1
  );
  // 100% MATHEMATICALLY PRECISE MONTH TRACKING SYSTEM
  const monthMarkers = useMemo(() => {
    const markers: Array<{ label: string; weekIndex: number }> = [];
    const seenMonths = new Set<string>();

    for (let w = 0; w < weekCount; w++) {
      const weekCells = cells.slice(w * 7, (w + 1) * 7);

      for (const cell of weekCells) {
        if (!cell.inRange) continue;

        const currentMonth = cell.date.getMonth();
        const currentYear = cell.date.getFullYear();
        const monthKey = `${currentYear}-${currentMonth}`;

        if (!seenMonths.has(monthKey)) {
          seenMonths.add(monthKey);

          markers.push({
            label: monthFormatter.format(cell.date),
            weekIndex: w,
          });
          break; // Move immediately to scanning the next column track block
        }
      }
    }
    return markers;
  }, [cells, weekCount]);

  // Shared matrix geometries matching baseline canvas dimensions
  const totalGridWidth = LABEL_WIDTH + (weekCount * CELL_SIZE) + ((weekCount - 1) * CELL_GAP);

  const gridStyle = {
    gridTemplateColumns: `${LABEL_WIDTH}px repeat(${weekCount}, ${CELL_SIZE}px)`,
    gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
    columnGap: `${CELL_GAP}px`,
    rowGap: `${CELL_GAP}px`,
  } as const;

  const today = new Date();
  const getHeatmapColor = (count: number) => {
    if (count === 0) return themeConfig.missed;

    const normalized = count / maxCommits;

    if (normalized <= 0.25) {
      return themeConfig.levelOne;
    }

    if (normalized <= 0.5) {
      return themeConfig.levelTwo;
    }

    if (normalized <= 0.75) {
      return themeConfig.levelThree;
    }

    return themeConfig.levelFour;
  };
  const totalCommits = cells
    .filter((cell) => cell.inRange)
    .reduce((total, cell) => total + cell.count, 0);
  const { inRangeDays, insights } = useMemo(() => {
    const days = cells
      .filter((cell) => cell.inRange)
      .map((cell) => ({
        date: cell.date,
        dateKey: cell.dateKey,
        count: cell.count,
      }));
    return {
      inRangeDays: days,
      insights: getContributionInsights(days),
    };
  }, [cells]);

  const heatmapSummary = `Contribution heatmap showing ${formatCommitCount(totalCommits)} across ${displayDays} days.`;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">
      <div className="mb-4 flex flex-col items-start justify-between gap-3">
        <div className="w-full">
          <h2 className="text-base font-semibold text-[var(--card-foreground)] dark:text-white">Contribution Heatmap</h2>          
          <p className="text-xs text-[var(--muted-foreground)] dark:text-gray-300">
            {customLabel ? `${customLabel}` : `Last ${selectedDays} days of commit activity.`}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2">
          {/* Range buttons */}
          <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] p-1">
            {PRESET_RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => handleRangeChange(r.days)}
                aria-label={`Show ${r.days}-day range`}
                aria-pressed={selectedDays === r.days && !customLabel}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedDays === r.days && !customLabel
                    ? "bg-[var(--accent)] text-[var(--background)]"
                    : "text-[var(--muted-foreground)] dark:text-gray-300 hover:text-[var(--foreground)] dark:hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Custom date range popover */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowPopover((v) => !v)}
              aria-label={customLabel ? `Custom date range: ${customLabel}` : "Select custom date range"}
              aria-expanded={showPopover}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors border border-[var(--border)] ${
                customLabel
                  ? "bg-[var(--accent)] text-[var(--background)]"
                  : "text-[var(--muted-foreground)] dark:text-gray-300 hover:text-[var(--foreground)] dark:hover:text-white"
              }`}
            >
              {customLabel ?? "Custom..."}
            </button>

            {showPopover && (
              <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg">
                <p className="text-sm font-medium text-[var(--foreground)] mb-3">
                  Custom range
                </p>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[var(--muted-foreground)]">
                    Start date
                    <input
                      type="date"
                      value={customFrom}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => {
                        setCustomFrom(e.target.value);
                        if (!customTo) {
                          setCustomTo(new Date().toISOString().slice(0, 10));
                        }
                      }}
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)]"
                    />
                  </label>
                  <label className="text-xs text-[var(--muted-foreground)]">
                    End date
                    <input
                      type="date"
                      value={customTo}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)]"
                    />
                  </label>
                  {customError && (
                    <p className="text-xs text-[var(--destructive)]">{customError}</p>
                  )}
                  <button
                    onClick={handleCustomApply}
                    className="mt-2 w-full rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--background)] transition-opacity hover:opacity-90 active:scale-95"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setTheme("default")}
            style={theme === "default" ? { backgroundColor: themeConfig.accent, color: "#fff" } : undefined}
            className="rounded px-2 py-1 text-xs dark:text-gray-300"
          >
            Default
          </button>
          <button
            type="button"
            onClick={() => setTheme("colour-blind-friendly")}
            style={theme === "colour-blind-friendly" ? { backgroundColor: themeConfig.accent, color: "#fff" } : undefined}
            className="rounded px-2 py-1 text-xs dark:text-gray-300"
          >
            Colour-blind
          </button>
        </div>

        {/* Legend - Less / More */}
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="dark:text-gray-300">Less</span>
          <div className="flex items-center gap-1">
            {[
              0,
              Math.ceil(maxCommits * 0.25),
              Math.ceil(maxCommits * 0.5),
              Math.ceil(maxCommits * 0.75),
              maxCommits,
            ].map((count, index) => {
              const swatch = getHeatmapColor(count);
              return (
                <span
                  key={index} // <-- Changed from count to index
                  className="h-3 w-3 rounded-sm border"
                  style={{ backgroundColor: swatch, borderColor: themeConfig.border }}
                />
              );
            })}
          </div>
          <span className="dark:text-gray-300">More</span>
        </div>
      </div>

      {loading ? (
        <div className="h-[300px] animate-pulse rounded-lg bg-[var(--card-muted)]" />
      ) : error ? (
        <div className="flex h-[180px] items-center rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4">
          <p className="text-sm text-[var(--destructive)]">{error} Please try refreshing.</p>
        </div>
      ) : (
        <>
          <div
            className="overflow-x-auto pb-2 scrollbar-thin"
            role="img"
            aria-label={heatmapSummary}
          >
            <div className="mx-auto flex flex-col gap-1" style={{ width: `${totalGridWidth}px` }}>
              
              {/* MATHEMATICAL COORDINATE TIMELINE HEADER BANNER CONTAINER */}
              <div 
                className="relative w-full text-[11px] font-semibold text-[var(--foreground)] dark:text-gray-200" 
                style={{ height: `${HEADER_HEIGHT}px` }}
              >
                {monthMarkers.map((marker, idx) => {
                  const absoluteLeftOffset = LABEL_WIDTH + (marker.weekIndex * (CELL_SIZE + CELL_GAP));
                  const nextMarker = monthMarkers[idx + 1];
                  const nextOffset = nextMarker ? LABEL_WIDTH + (nextMarker.weekIndex * (CELL_SIZE + CELL_GAP)) : totalGridWidth;
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

              {/* Grid System Area mapping identical columns */}
              <div className="grid items-center" style={gridStyle}>
                {DAY_LABELS.map((label, rowIndex) => (
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
                  const formattedDate = cell.date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  const accessibleLabel = `${formatCommitCount(cell.count)} on ${cell.dateKey}`;
                  const tooltip = `${formatCommitCount(cell.count)} on ${formattedDate}`;

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      title={isFuture ? "" : tooltip}
                      aria-label={isFuture ? `Future date on ${cell.dateKey}` : accessibleLabel}
                      disabled={isFuture}
                      onClick={() => !isFuture && setSelectedDate(cell.dateKey)}
                      className={`group relative z-0 h-4 w-4 rounded-[3px] border transition-transform hover:z-20 hover:scale-110 focus:z-20 focus-visible:ring-2 focus-visible:ring-[var(--heatmap-focus-ring)] disabled:cursor-default disabled:opacity-20 ${
                        cell.inRange ? "opacity-100" : "opacity-40"
                      }`}
                      style={{
                        gridRow: dayIndex + 1,
                        gridColumn: weekIndex + 2,
                        backgroundColor: isFuture
                          ? "transparent"
                          : getHeatmapColor(cell.count),
                        borderColor: themeConfig.border,
                        ["--heatmap-focus-ring" as any]: themeConfig.accent,
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

          {/* Commits shown + Updated timestamp */}
          <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[var(--muted-foreground)] dark:text-gray-400">
            <p>
              {totalCommits} commits shown across {displayDays} days.
            </p>
            <LastUpdatedTimestamp lastUpdated={lastUpdated} relativeLabel={relativeLabel} />
          </div>

          {/* Contribution Insights section */}
          <div className="mt-6 border-t border-[var(--border)] pt-6">
            <h3 className="text-sm font-semibold text-[var(--card-foreground)] dark:text-white mb-4">
              Contribution Insights
            </h3>
            
            {inRangeDays.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">No contribution data available for this range.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" role="region" aria-label="Contribution Insights Panel">
                {/* Most Productive Weekday */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--control)] p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-blue-500" aria-hidden="true" />
                    <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                      Most Productive Day
                    </span>
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-[var(--card-foreground)] dark:text-white">
                      {insights.mostProductiveWeekday}
                    </span>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                      Day with highest average commits
                    </p>
                  </div>
                </div>

                {/* Average Weekly Contributions */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--control)] p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart2 className="h-4 w-4 text-green-500" aria-hidden="true" />
                    <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                      Avg Weekly Contributions
                    </span>
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-[var(--card-foreground)] dark:text-white">
                      {insights.averageWeeklyContributions.toFixed(1)}
                    </span>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                      Commits per 7 calendar days
                    </p>
                  </div>
                </div>

                {/* Longest Contribution Streak */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--control)] p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                      Longest Streak
                    </span>
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-[var(--card-foreground)] dark:text-white">
                      {insights.longestStreak} {insights.longestStreak === 1 ? 'day' : 'days'}
                    </span>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                      Max consecutive active days
                    </p>
                  </div>
                </div>

                {/* Longest Inactive Period */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--control)] p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-red-500" aria-hidden="true" />
                    <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                      Longest Inactive Period
                    </span>
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-[var(--card-foreground)] dark:text-white">
                      {insights.longestInactivePeriod} {insights.longestInactivePeriod === 1 ? 'day' : 'days'}
                    </span>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                      Max consecutive days with zero commits
                    </p>
                  </div>
                </div>

                {/* Monthly Contribution Trends */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--control)] p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-purple-500" aria-hidden="true" />
                    <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                      Monthly Trend
                    </span>
                  </div>
                  <div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                      insights.monthlyTrend === 'Increasing'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : insights.monthlyTrend === 'Decreasing'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {insights.monthlyTrend}
                    </span>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-2">
                      Recent month vs preceding month
                    </p>
                  </div>
                </div>

                {/* Best Contribution Month */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--control)] p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                    <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                      Best Month
                    </span>
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-[var(--card-foreground)] dark:text-white truncate block">
                      {insights.bestMonth}
                    </span>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                      Highest total ({insights.bestMonthTotal} commits)
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <DailyBreakdownSheet
        date={selectedDate}
        onClose={handleCloseSheet}
        heatmapData={data}
      />
    </div>
  );
}
