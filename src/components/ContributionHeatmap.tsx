"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHeatmapTheme } from "@/hooks/useHeatmapTheme";
import DailyBreakdownSheet from "@/components/DailyBreakdownSheet";
import ContributionHeatmapCalendar from "@/components/ContributionHeatmapCalendar";
import { formatDateKey, countInRangeCommits, buildHeatmap } from "@/lib/contribution-heatmap";

interface ContributionHeatmapProps {
  days?: number;
}

interface ContributionResponse {
  data: Record<string, number>;
}

const DEFAULT_DAYS = 365;

const PRESET_RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "6mo", days: 180 },
  { label: "1yr", days: 365 },
] as const;

export default function ContributionHeatmap({
  days = DEFAULT_DAYS,
}: ContributionHeatmapProps) {
  const [data, setData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const handleCloseSheet = useCallback(() => setSelectedDate(null), []);

  const [selectedDays, setSelectedDays] = useState(days);
  const [showPopover, setShowPopover] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("devtrack:heatmap-range");
        if (stored === "30" || stored === "90" || stored === "180" || stored === "365") {
          setSelectedDays(Number(stored));
        } else {
          localStorage.setItem("devtrack:heatmap-range", String(days));
        }
      } catch {
        setSelectedDays(days);
      }
    }
  }, [days]);

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
      } catch {
        /* ignore */
      }
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

  const currentFrom = customLabel
    ? customFrom
    : (() => {
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
        setMinutesAgo(0);
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

  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => {
      setMinutesAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 60000));
    }, 60000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const { themeConfig, theme, setTheme } = useHeatmapTheme();

  const displayDays = useMemo(() => {
    if (customLabel && customFrom && customTo) {
      const msPerDay = 1000 * 60 * 60 * 24;
      return (
        Math.ceil(
          (new Date(customTo).getTime() - new Date(customFrom).getTime()) / msPerDay
        ) + 1
      );
    }
    return selectedDays;
  }, [customLabel, customFrom, customTo, selectedDays]);

  const totalCommits = useMemo(() => {
    const cells = buildHeatmap(
      displayDays,
      data,
      customLabel ? customFrom : undefined,
      customLabel ? customTo : undefined
    );
    return countInRangeCommits(cells);
  }, [displayDays, data, customLabel, customFrom, customTo]);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">
      <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-4 sm:gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--card-foreground)] dark:text-white">
            Contribution Heatmap
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] dark:text-gray-300">
            {customLabel ? `${customLabel}` : `Last ${selectedDays} days of commit activity.`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2">
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

          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowPopover((v) => !v)}
              aria-label={
                customLabel ? `Custom date range: ${customLabel}` : "Select custom date range"
              }
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
                <p className="text-sm font-medium text-[var(--foreground)] mb-3">Custom range</p>
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
            style={
              theme === "default"
                ? { backgroundColor: themeConfig.accent, color: "#fff" }
                : undefined
            }
            className="rounded px-2 py-1 text-xs dark:text-gray-300"
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
            className="rounded px-2 py-1 text-xs dark:text-gray-300"
          >
            Colour-blind
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex h-[180px] items-center rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4">
          <p className="text-sm text-[var(--destructive)]">{error} Please try refreshing.</p>
        </div>
      ) : (
        <>
          <ContributionHeatmapCalendar
            data={data}
            days={displayDays}
            fromDate={customLabel ? customFrom : undefined}
            toDate={customLabel ? customTo : undefined}
            themeConfig={themeConfig}
            onCellClick={setSelectedDate}
            loading={loading}
          />

          <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[var(--muted-foreground)] dark:text-gray-400">
            <p>
              {totalCommits} commits shown across {displayDays} days.
            </p>
            {lastUpdated && (
              <p>{minutesAgo === 0 ? "Updated just now" : `Updated ${minutesAgo} min ago`}</p>
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
