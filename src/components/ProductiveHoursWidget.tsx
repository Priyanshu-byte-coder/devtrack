"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHeatmapTheme } from "@/hooks/useHeatmapTheme";

const DEFAULT_DAYS = 90;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const PRESET_RANGES = [
  { label: "30d",  days: 30  },
  { label: "90d",  days: 90  },
  { label: "6mo",  days: 180 },
  { label: "1yr",  days: 365 },
] as const;

interface HourlyCell {
  day: number;
  hour: number;
  count: number;
  avg: number;
}

interface ProductiveHoursResponse {
  grid: HourlyCell[];
  peak: HourlyCell | null;
  total: number;
  days: number;
  timezone: string;
}

interface TooltipState {
  day: number;
  hour: number;
  avg: number;
  col: number;
  row: number;
}

function formatHour(h: number): string {
  if (h === 0)   return "12am";
  if (h === 12)  return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ProductiveHoursWidget() {
  const { themeConfig, theme, setTheme } = useHeatmapTheme();

  const [grid, setGrid]             = useState<HourlyCell[]>([]);
  const [peak, setPeak]             = useState<HourlyCell | null>(null);
  const [totalCommits, setTotal]    = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState(0);

  const [tooltip, setTooltip]       = useState<TooltipState | null>(null);
  const handleClearTooltip          = useCallback(() => setTooltip(null), []);

  const [selectedDays, setSelectedDays] = useState(DEFAULT_DAYS);
  const [showPopover, setShowPopover]   = useState(false);
  const [customFrom, setCustomFrom]     = useState("");
  const [customTo, setCustomTo]         = useState("");
  const [customLabel, setCustomLabel]   = useState<string | null>(null);
  const [customError, setCustomError]   = useState<string | null>(null);
  const popoverRef                      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("devtrack:productive-hours-range");
      const valid  = ["30", "90", "180", "365"];
      if (stored && valid.includes(stored)) {
        setSelectedDays(Number(stored));
      }
    } catch {
      // localStorage unavailable — use default
    }
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

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

  const handleRangeChange = useCallback((newDays: number) => {
    setSelectedDays(newDays);
    setCustomLabel(null);
    setCustomFrom("");
    setCustomTo("");
    setCustomError(null);
    try {
      localStorage.setItem("devtrack:productive-hours-range", String(newDays));
    } catch {}
  }, []);

  const handleCustomApply = useCallback(() => {
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
    const msPerDay = 1_000 * 60 * 60 * 24;
    const diff = (new Date(customTo).getTime() - new Date(customFrom).getTime()) / msPerDay;
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
    setCustomLabel(`${fmt(customFrom)} – ${fmt(customTo)}`);
    setShowPopover(false);
  }, [customFrom, customTo]);

  const { currentFrom, currentTo } = useMemo(() => {
    if (customLabel && customFrom && customTo) {
      return { currentFrom: customFrom, currentTo: customTo };
    }
    const end   = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (selectedDays - 1));
    return {
      currentFrom: formatDateKey(start),
      currentTo:   formatDateKey(end),
    };
  }, [customLabel, customFrom, customTo, selectedDays]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const params = new URLSearchParams({
      from: currentFrom,
      to:   currentTo,
      tz,
    });

    fetch(`/api/metrics/productive-hours?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then((data: ProductiveHoursResponse) => {
        if (!active) return;
        setGrid(data.grid ?? []);
        setPeak(data.peak ?? null);
        setTotal(data.total ?? 0);
        setLastUpdated(new Date());
        setMinutesAgo(0);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load productive hours data.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => { active = false; };
  }, [currentFrom, currentTo]);

  useEffect(() => {
    if (!lastUpdated) return;
    const id = setInterval(() => {
      setMinutesAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 60_000));
    }, 60_000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const maxAvg = useMemo(
    () => Math.max(...grid.map((c) => c.avg), 1),
    [grid]
  );

  const getCellColor = useCallback(
    (avg: number): string => {
      if (avg === 0) return themeConfig.missed;
      const normalized = avg / maxAvg;
      if (normalized <= 0.25) return themeConfig.levelOne;
      if (normalized <= 0.50) return themeConfig.levelTwo;
      if (normalized <= 0.75) return themeConfig.levelThree;
      return themeConfig.levelFour;
    },
    [maxAvg, themeConfig]
  );

  const cellMap = useMemo(() => {
    const m = new Map<string, HourlyCell>();
    for (const cell of grid) m.set(`${cell.day}-${cell.hour}`, cell);
    return m;
  }, [grid]);

  const DAY_LABEL_WIDTH = 32;
  const CELL_GAP = 2;
  const availableWidth = containerWidth > 0 ? containerWidth - DAY_LABEL_WIDTH - 23 * CELL_GAP : 0;
  const CELL_SIZE = Math.max(10, availableWidth > 0 ? Math.floor(availableWidth / 24) : 14);

  const gridStyle = {
    gridTemplateColumns: `${DAY_LABEL_WIDTH}px repeat(24, 1fr)`,
    gridTemplateRows:    `repeat(7, ${CELL_SIZE}px)`,
    columnGap:           `${CELL_GAP}px`,
    rowGap:              `${CELL_GAP}px`,
  } as const;

  return (
    <div ref={containerRef} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">

      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
              Most Productive Hours
            </h2>
            <div className="group relative">
              <span
                className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[var(--border)] text-[10px] text-[var(--muted-foreground)]"
                aria-label="About this chart"
              >
                ?
              </span>
              <div className="pointer-events-none absolute left-0 top-5 z-50 hidden w-64 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--muted-foreground)] shadow-lg group-hover:block">
                Shows your average commits per hour and day of week over the
                selected date range, adjusted to your local timezone.
              </div>
            </div>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {customLabel
              ? customLabel
              : `Last ${selectedDays} days — commit activity by hour & day`}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset range pills */}
          <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] p-1">
            {PRESET_RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => handleRangeChange(r.days)}
                aria-label={`Show ${r.days}-day range`}
                aria-pressed={selectedDays === r.days && !customLabel}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  selectedDays === r.days && !customLabel
                    ? "bg-[var(--accent)] text-[var(--background)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowPopover((v) => !v)}
              className={`rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium transition-colors ${
                customLabel
                  ? "bg-[var(--accent)] text-[var(--background)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {customLabel ?? "Custom…"}
            </button>

            {showPopover && (
              <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg">
                <p className="mb-3 text-sm font-medium text-[var(--foreground)]">
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
                    className="mt-2 w-full rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--background)] transition-opacity hover:opacity-90"
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
            style={
              theme === "default"
                ? { backgroundColor: themeConfig.accent, color: "#fff" }
                : undefined
            }
            className="rounded px-2 py-1 text-xs"
          >
            Default
          </button>
          <button
            type="button"
            onClick={() => setTheme("colour-blind-friendly")}
            style={
              theme === "colour-blind-friendly"
                ? { backgroundColor: themeConfig.accent, color: "#fff" }
                : undefined
            }
            className="rounded px-2 py-1 text-xs"
          >
            Colour-blind
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span>Less</span>
          <div className="flex items-center gap-1">
            {[0, maxAvg * 0.25, maxAvg * 0.5, maxAvg * 0.75, maxAvg].map(
              (v, i) => (
                <span
                  key={i}
                  className="h-3 w-3 rounded-sm border"
                  style={{
                    backgroundColor: getCellColor(v),
                    borderColor: themeConfig.border,
                  }}
                />
              )
            )}
          </div>
          <span>More</span>
        </div>
      </div>

      {loading ? (
        <div className="h-[140px] animate-pulse rounded-lg bg-[var(--card-muted)]" />
      ) : error ? (
        <div className="flex h-[140px] items-center rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4">
          <p className="text-sm text-[var(--destructive)]">
            {error} Please try refreshing.
          </p>
        </div>
      ) : (
        <>
          <div className="w-full">
            <div className="w-full">

              {/* Hour axis labels — every 3 hours to avoid crowding */}
              <div
                className="mb-1 grid"
                style={{
                  gridTemplateColumns: `${DAY_LABEL_WIDTH}px repeat(24, 1fr)`,
                  columnGap: `${CELL_GAP}px`,
                }}
              >
                <div /> {/* spacer for day-label column */}
                {HOURS.map((h) => (
                  <div key={h} className="text-center">
                    {h % 3 === 0 ? (
                      <span className="text-[9px] font-medium text-[var(--muted-foreground)]">
                        {formatHour(h)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* 7 × 24 grid */}
              <div className="grid" style={gridStyle}>
                {/* Day-of-week row labels (col 1) */}
                {DAY_LABELS.map((label, rowIndex) => (
                  <div
                    key={label}
                    className="flex items-center justify-end pr-2 text-[10px] text-[var(--muted-foreground)]"
                    style={{
                      gridRow:    rowIndex + 1,
                      gridColumn: 1,
                      opacity: rowIndex % 2 === 0 ? 1 : 0,
                    }}
                  >
                    {rowIndex % 2 === 0 ? label : ""}
                  </div>
                ))}

                {/* Data cells */}
                {DAY_LABELS.map((_, rowIndex) =>
                  HOURS.map((hour) => {
                    const cell = cellMap.get(`${rowIndex}-${hour}`);
                    const avg  = cell?.avg ?? 0;

                    const showTooltipBelow  = rowIndex < 2;
                    const isNearRightEdge   = hour >= 21;

                    const tooltipText = `${DAY_FULL[rowIndex]} ${formatHour(hour)} — avg ${avg.toFixed(1)} commit${avg === 1 ? "" : "s"}`;

                    return (
                      <button
                        key={`${rowIndex}-${hour}`}
                        type="button"
                        aria-label={tooltipText}
                        title={tooltipText}
                        onMouseEnter={() =>
                          setTooltip({ day: rowIndex, hour, avg, col: hour, row: rowIndex })
                        }
                        onMouseLeave={handleClearTooltip}
                        className="group relative z-0 w-full rounded-[3px] border transition-transform hover:z-20 hover:scale-110 focus:z-20 focus:outline-none focus:ring-2 focus:ring-[var(--heatmap-focus-ring)]"
                        style={{
                          gridRow:    rowIndex + 1,
                          gridColumn: hour + 2,      // +2 because col 1 is the day label
                          backgroundColor: getCellColor(avg),
                          borderColor: themeConfig.border,
                          ["--heatmap-focus-ring" as any]: themeConfig.accent,
                        }}
                      >
                        <span
                          className={`pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-[var(--foreground)] px-2 py-1 text-[11px] text-[var(--background)] shadow-lg group-hover:block group-focus:block ${
                            showTooltipBelow ? "top-full mt-2" : "bottom-full mb-2"
                          } ${
                            isNearRightEdge
                              ? "right-0 translate-x-0"
                              : "left-1/2 -translate-x-1/2"
                          }`}
                        >
                          {tooltipText}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[var(--muted-foreground)]">
            <p>
              {totalCommits} commits analysed.
              {peak && peak.avg > 0 && (
                <span className="ml-2 font-medium text-[var(--foreground)]">
                  🔥 Peak: {DAY_FULL[peak.day]} {formatHour(peak.hour)} — avg{" "}
                  {peak.avg.toFixed(1)} commits
                </span>
              )}
            </p>
            {lastUpdated && (
              <p>
                {minutesAgo === 0
                  ? "Updated just now"
                  : `Updated ${minutesAgo} min ago`}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}