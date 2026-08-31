"use client";

import { useEffect, useState, useCallback } from "react";

interface GoalHistoryEntry {
  id: string;
  goal_id: string;
  goal_title: string;
  goal_unit: string;
  period_start: string;
  period_end: string;
  target: number;
  achieved: number;
  completed: boolean;
}

function formatWeekOf(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function GoalHistory() {
  const [history, setHistory] = useState<GoalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/goals/history");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load goal history.");
        return;
      }
      const data: { history: GoalHistoryEntry[] } = await res.json();
      setHistory(data.history ?? []);
      setFetched(true);
    } catch {
      setError("Network error. Could not load goal history.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch only when the section is first opened
  useEffect(() => {
    if (open && !fetched) {
      fetchHistory();
    }
  }, [open, fetched, fetchHistory]);

  return (
    <div className="mt-6 border-t border-[var(--border)] pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold text-[var(--card-foreground)] hover:text-[var(--accent)] transition-colors"
        aria-expanded={open}
        aria-controls="goal-history-panel"
      >
        <span>Past Goals</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div id="goal-history-panel" className="mt-3">
          {loading && (
            <div role="status" aria-live="polite" aria-busy="true" className="space-y-3">
              <span className="sr-only">Loading goal history</span>
              {[1, 2, 3].map((i) => (
                <div key={i} aria-hidden="true" className="h-12 rounded-lg bg-[var(--card-muted)] animate-pulse" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)] flex items-center justify-between gap-2">
              <span>⚠️ {error}</span>
              <button
                type="button"
                onClick={fetchHistory}
                className="underline hover:opacity-70 font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && fetched && history.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">
              No past goals yet. Completed or expired recurring goals will appear here.
            </p>
          )}

          {!loading && !error && history.length > 0 && (
            <ul className="space-y-2" aria-label="Past goals">
              {history.map((entry) => {
                const pct = entry.target > 0
                  ? Math.min(Math.round((entry.achieved / entry.target) * 100), 100)
                  : 0;

                return (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--control)] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-base leading-none"
                          aria-label={entry.completed ? "Completed" : "Missed"}
                        >
                          {entry.completed ? "✅" : "❌"}
                        </span>
                        <span className="text-sm font-medium text-[var(--card-foreground)] truncate">
                          {entry.goal_title}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          entry.completed
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-[var(--destructive)]/10 text-[var(--destructive)]"
                        }`}
                      >
                        {entry.completed ? "Completed" : `Missed (${entry.achieved}/${entry.target})`}
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--card-muted)]">
                      <div
                        className={`h-full rounded-full ${
                          entry.completed ? "bg-emerald-500" : "bg-[var(--accent)]/50"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                      Week of {formatWeekOf(entry.period_start)} &middot;{" "}
                      {entry.achieved}/{entry.target} {entry.goal_unit}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
