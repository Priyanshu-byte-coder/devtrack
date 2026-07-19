"use client";

import { useEffect, useState, useMemo } from "react";
import { summarizeCodingActivity } from "@/lib/coding-activity-insights";
import { useHeatmapTheme } from "@/hooks/useHeatmapTheme";
import { useAccount } from "@/components/AccountContext";

const DATA_WINDOW_DAYS = 90;


interface RepoActivityDrawerProps {
  repoName: string;
  isOpen: boolean;
  onClose: () => void;
}

// Same helper as ContributionHeatmap
function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildHeatmap(days: number, contributions: Record<string, number>) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const firstWeekStart = new Date(startDate);
  firstWeekStart.setDate(startDate.getDate() - startDate.getDay());
  firstWeekStart.setHours(0, 0, 0, 0);

  const lastWeekEnd = new Date(endDate);
  lastWeekEnd.setDate(endDate.getDate() + (6 - endDate.getDay()));
  lastWeekEnd.setHours(23, 59, 59, 999);

  const cells: { date: Date; dateKey: string; count: number; inRange: boolean }[] = [];
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RepoActivityDrawer({ repoName, isOpen, onClose }: RepoActivityDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const { themeConfig } = useHeatmapTheme();
  const { selectedAccount } = useAccount();

  useEffect(() => {
    if (!isOpen || !repoName) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);

    let active = true;
    setLoading(true);

    const accountParam = selectedAccount ? `?accountId=${selectedAccount}` : "";

    fetch(`/api/metrics/repos/${repoName}/commits${accountParam}`)
      .then(r => r.json())
      .then(d => {
        if (!active) return;
        if (d.error) {
          setData(null);
        } else {
          const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const summary = summarizeCodingActivity(d.timestamps, userTimeZone);
          setData({ heatmapData: d.heatmapData, summary });
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, repoName, selectedAccount, onClose]);

  // Trap focus (simple version)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const cells = useMemo(() => {
    if (!data?.heatmapData) return [];
    return buildHeatmap(90, data.heatmapData);
  }, [data]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-[100] transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        className="fixed inset-y-0 right-0 w-full max-w-md bg-[var(--card)] z-[110] shadow-xl border-l border-[var(--border)] overflow-y-auto transform transition-transform"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 id="drawer-title" className="text-xl font-bold text-[var(--card-foreground)] truncate max-w-[80%]">
              {repoName}
            </h2>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-[var(--card-muted)] rounded-full transition-colors"
              aria-label="Close drawer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--foreground)]"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-24 bg-[var(--card-muted)] rounded-xl" />
              <div className="h-40 bg-[var(--card-muted)] rounded-xl" />
            </div>
          ) : data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--control)] p-4 rounded-xl border border-[var(--border)]">
                  <div className="text-sm text-[var(--muted-foreground)] mb-1">Total Commits (90d)</div>
                  <div className="text-2xl font-bold text-[var(--card-foreground)]">
                    {data.summary.totalActivities}
                  </div>
                </div>
                <div className="bg-[var(--control)] p-4 rounded-xl border border-[var(--border)]">
                  <div className="text-sm text-[var(--muted-foreground)] mb-1">Most Active Day</div>
                  <div className="text-lg font-bold text-[var(--card-foreground)]">
                    {data.summary.mostActiveDay?.day || "N/A"}
                  </div>
                </div>
                <div className="bg-[var(--control)] p-4 rounded-xl border border-[var(--border)] col-span-2">
                  <div className="text-sm text-[var(--muted-foreground)] mb-1">Peak Hour</div>
                  <div className="text-lg font-bold text-[var(--card-foreground)]">
                    {data.summary.mostActiveHour?.label || "N/A"}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-3">{`Commit Heatmap (Last ${DATA_WINDOW_DAYS} Days)`}</h3>
                <div className="overflow-x-auto pb-2 scrollbar-thin">
                  <div 
                    className="grid gap-[2px]" 
                    style={{ 
                      gridTemplateColumns: `auto repeat(${Math.ceil(cells.length / 7)}, 12px)`,
                      gridTemplateRows: `repeat(7, 12px)`
                    }}
                  >
                    {DAY_LABELS.map((label, rowIndex) => (
                      <div
                        key={label}
                        className="flex items-center justify-end pr-2 text-[10px] text-[var(--muted-foreground)]"
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
                      const isFuture = cell.date > new Date();
                      
                      return (
                        <div
                          key={cell.dateKey}
                          title={isFuture ? "" : `${cell.dateKey}: ${cell.count} commits`}
                          className={`h-3 w-3 rounded-[3px] border ${cell.inRange ? "" : "opacity-35"}`}
                          style={{
                            gridRow: dayIndex + 1,
                            gridColumn: weekIndex + 2,
                            backgroundColor: isFuture
                              ? "transparent"
                              : cell.count === 0
                              ? themeConfig.missed
                              : cell.count < 2
                              ? themeConfig.levelOne
                              : cell.count < 4
                              ? themeConfig.levelTwo
                              : cell.count < 6
                              ? themeConfig.levelThree
                              : themeConfig.levelFour,
                            borderColor: themeConfig.border,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[var(--muted-foreground)]">Failed to load repository activity.</p>
          )}
        </div>
      </div>
    </>
  );
}
