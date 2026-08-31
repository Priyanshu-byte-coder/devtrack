"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Recurrence = "none" | "weekly" | "monthly";

interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  recurrence: Recurrence;
  period_start: string;
  last_synced_at: string | null;
}

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default function GoalTracker() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(7);
  const [unit, setUnit] = useState("commits");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [activeConfettiGoalId, setActiveConfettiGoalId] =
    useState<string | null>(null);

  const prevGoalsRef = useRef<Map<string, boolean>>(new Map());
  const initialLoadDoneRef = useRef<boolean>(false);

  const loadGoals = useCallback(async () => {
    const response = await fetch("/api/goals");
    const data: { goals: Goal[] } = await response.json();

    const fetchedGoals = data.goals ?? [];

    setGoals(fetchedGoals);

    return fetchedGoals;
  }, []);

  /**
   * Sync commit-based goals from GitHub, then reload.
   */
  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);

    try {
      const res = await fetch("/api/goals/sync", {
        method: "POST",
      });

      if (!res.ok) {
        let msg = "Sync failed. Please try again.";

        try {
          const errData = await res.json();

          if (errData && errData.error) {
            msg = errData.error;
          }
        } catch {}

        if (res.status === 401) {
          msg = "Unauthorized. Please log in again.";
        } else if (res.status === 502) {
          msg = "GitHub sync failed: Expired token or missing repo scope.";
        }

        setSyncError(msg);
        return;
      }

      await loadGoals();

      setLastUpdated(new Date());
      setMinutesAgo(0);
    } catch {
      setSyncError("Network error. Failed to sync goals.");
    } finally {
      setSyncing(false);
    }
  }, [loadGoals]);

  // On mount: load goals then auto-sync if stale.
  useEffect(() => {
    loadGoals()
      .then(async (fetchedGoals) => {
        const needsSync = fetchedGoals.some((g: Goal) => {
          if (g.unit !== "commits") {
            return false;
          }

          if (!g.last_synced_at) {
            return true;
          }

          const syncedAt = new Date(g.last_synced_at).getTime();

          return Date.now() - syncedAt > 15 * 60 * 1000;
        });

        if (needsSync) {
          await handleSync();
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setLastUpdated(new Date());
        setMinutesAgo(0);
      });
  }, [loadGoals, handleSync]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          target,
          unit,
          recurrence,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create goal");
      }
    } catch {
      setCreateError("Failed to create goal. Please try again.");
      setCreating(false);
      return;
    }

    setTitle("");
    setTarget(7);
    setUnit("commits");
    setRecurrence("none");

    // Immediately sync if it was a commit-based goal.
    if (unit === "commits") {
      await handleSync();
    } else {
      await loadGoals().catch(() => {});
    }

    setCreating(false);
  }

  async function handleDelete(id: string) {
    const previousGoals = goals;

    setGoals((prev) => prev.filter((g) => g.id !== id));
    setConfirmingId(null);
    setDeletingId(id);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setGoals(previousGoals);
        setDeleteError("Failed to delete goal. Please try again.");
      }
    } catch {
      setGoals(previousGoals);
      setDeleteError("Failed to delete goal. Please check your connection.");
    } finally {
      setDeletingId(null);
    }
  }

  function getCompletionLabel(goal: Goal): string {
    if (goal.current >= goal.target) {
      if (goal.recurrence === "weekly") {
        return "Completed this week ✓";
      }

      if (goal.recurrence === "monthly") {
        return "Completed this month ✓";
      }

      return "Completed ✓";
    }

    return "";
  }

  useEffect(() => {
    if (goals.length === 0) {
      return;
    }

    if (!initialLoadDoneRef.current) {
      const map = new Map<string, boolean>();

      for (const g of goals) {
        map.set(g.id, g.current >= g.target);
      }

      prevGoalsRef.current = map;
      initialLoadDoneRef.current = true;

      return;
    }

    for (const g of goals) {
      const isCompleted = g.current >= g.target;
      const wasCompleted = prevGoalsRef.current.get(g.id);

      if (wasCompleted === false && isCompleted) {
        if (
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          setActiveConfettiGoalId(g.id);

          setTimeout(() => {
            setActiveConfettiGoalId((curr) =>
              curr === g.id ? null : curr
            );
          }, 2500);
        }
      }

      prevGoalsRef.current.set(g.id, isCompleted);
    }
  }, [goals]);

  useEffect(() => {
    if (!lastUpdated) {
      return;
    }

    const interval = setInterval(() => {
      const diff = Math.floor(
        (Date.now() - lastUpdated.getTime()) / 60000
      );

      setMinutesAgo(diff);
    }, 60000);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  if (loading) {
    return (
      <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">Loading weekly goals</span>

          <div
            aria-hidden="true"
            className="mb-4 h-5 w-32 rounded bg-[var(--card-muted)] animate-pulse"
          />

          {[1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className="mb-4"
            >
              <div className="h-4 bg-[var(--card-muted)] rounded animate-pulse mb-2" />

              <div className="h-2 bg-[var(--card-muted)] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
          Goals
        </h2>

        <button
          onClick={handleSync}
          disabled={syncing}
          title="Refresh commit-based goals from GitHub"
          aria-label="Refresh commit goals"
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs text-[var(--muted-foreground)] transition hover:text-[var(--card-foreground)] hover:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-3.5 h-3.5 ${
              syncing ? "animate-spin" : ""
            }`}
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M15.312 3.312a.75.75 0 011.06 1.06l-1.43 1.43A8 8 0 1118 10a.75.75 0 01-1.5 0 6.5 6.5 0 10-1.923 4.596l-1.43-1.43a.75.75 0 011.06-1.06l2.75 2.75a.75.75 0 010 1.06l-2.75 2.75a.75.75 0 01-1.06-1.06l1.43-1.43A8 8 0 012 10 8 8 0 0115.312 3.312z"
              clipRule="evenodd"
            />
          </svg>

          {syncing ? "Syncing…" : "Refresh"}
        </button>
      </div>

      {/* Sync Error */}
      {syncError && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
          <span>⚠️ {syncError}</span>

          <button
            type="button"
            onClick={() => setSyncError(null)}
            className="text-[var(--destructive)] hover:opacity-70 font-semibold"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Delete Error */}
      {deleteError && (
        <div className="mb-4 rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)] flex justify-between items-center">
          <p>{deleteError}</p>

          <button
            onClick={() => setDeleteError(null)}
            className="text-[var(--destructive)] hover:opacity-80 ml-2"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {goals.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No goals yet. Create one below.
        </p>
      ) : (
        <ul className="space-y-4">
          {goals.map((goal) => {
            /*
             * Fix for issue #1895:
             * Any non-zero progress should display at least 1%.
             * 0% should only be displayed when current === 0.
             */
            const pct =
              goal.current > 0
                ? Math.min(
                    Math.max(
                      1,
                      Math.round(
                        (goal.current / goal.target) * 100
                      )
                    ),
                    100
                  )
                : 0;

            const isConfirming = confirmingId === goal.id;
            const isDeleting = deletingId === goal.id;
            const completed = goal.current >= goal.target;
            const completionLabel = getCompletionLabel(goal);
            const isAutoSynced = goal.unit === "commits";

            return (
              <li key={goal.id} className="relative">
                {activeConfettiGoalId === goal.id && (
                  <ConfettiBurst />
                )}

                <div className="flex justify-between items-center text-sm mb-1">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[var(--card-foreground)]">
                        {goal.title}
                      </span>

                      {goal.recurrence !== "none" && (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            goal.recurrence === "weekly"
                              ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30"
                              : "bg-[var(--card-muted)] text-[var(--muted-foreground)] border-[var(--border)]"
                          }`}
                        >
                          {RECURRENCE_LABELS[goal.recurrence]}
                        </span>
                      )}

                      {isAutoSynced && (
                        <span
                          title={
                            goal.last_synced_at
                              ? `Last synced: ${new Date(
                                  goal.last_synced_at
                                ).toLocaleTimeString()}`
                              : "Auto-synced from GitHub commits"
                          }
                          className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-2.5 h-2.5"
                            aria-hidden="true"
                          >
                            <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
                          </svg>

                          Auto-synced
                        </span>
                      )}
                    </div>

                    {completed && (
                      <span className="text-xs font-medium text-emerald-500">
                        {completionLabel}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[var(--muted-foreground)]">
                      {goal.current}/{goal.target} {goal.unit}
                    </span>

                    {/* Manual +1 only for non-auto-synced goals */}
                    {!isAutoSynced && (
                      <button
                        onClick={async () => {
                          const newCurrent = goal.current + 1;

                          if (newCurrent > goal.target) {
                            return;
                          }

                          const res = await fetch(
                            `/api/goals/${goal.id}`,
                            {
                              method: "PATCH",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                current: newCurrent,
                              }),
                            }
                          );

                          if (res.ok) {
                            setGoals((prevGoals) =>
                              prevGoals.map((g) =>
                                g.id === goal.id
                                  ? {
                                      ...g,
                                      current: newCurrent,
                                    }
                                  : g
                              )
                            );
                          }
                        }}
                        disabled={goal.current >= goal.target}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        +1
                      </button>
                    )}

                    {isConfirming ? (
                      <span className="flex items-center gap-1 text-xs">
                        <span className="text-[var(--muted-foreground)]">
                          Delete?
                        </span>

                        <button
                          onClick={() => handleDelete(goal.id)}
                          disabled={isDeleting}
                          className="text-[var(--destructive)] hover:opacity-80 font-semibold transition-colors disabled:opacity-50"
                          aria-label={`Confirm delete goal: ${goal.title}`}
                        >
                          Yes
                        </button>

                        <span className="text-[var(--muted-foreground)]">
                          /
                        </span>

                        <button
                          onClick={() => setConfirmingId(null)}
                          className="text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] transition-colors"
                          aria-label="Cancel delete"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(goal.id)}
                        disabled={isDeleting}
                        className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors disabled:opacity-50"
                        aria-label={`Delete goal: ${goal.title}`}
                        title="Delete goal"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l-.3 7.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[var(--control)]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      completed
                        ? "bg-emerald-500"
                        : "bg-[var(--accent)]"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {lastUpdated && (
        <p className="text-xs text-[var(--muted-foreground)] mt-2 text-right">
          {minutesAgo === 0
            ? "Updated just now"
            : `Updated ${minutesAgo} min ago`}
        </p>
      )}

      {/* Goal Creation Form */}
      <form
        onSubmit={handleCreate}
        className="mt-6 space-y-3 border-t border-[var(--border)] pt-4"
      >
        <div>
          <label
            htmlFor="goal-title"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Goal title
          </label>

          <input
            id="goal-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Make 10 commits"
            required
            disabled={creating}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label
              htmlFor="goal-target"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              Target
            </label>

            <input
              id="goal-target"
              type="number"
              min={1}
              max={10000}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              disabled={creating}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex-1">
            <label
              htmlFor="goal-unit"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              Unit
            </label>

            <select
              id="goal-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={creating}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            >
              <option value="commits">Commits ⚡</option>
              <option value="prs">PRs</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>

        {/* Recurrence Picker */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Recurrence
          </label>

          <div className="flex gap-2">
            {(["none", "weekly", "monthly"] as Recurrence[]).map(
              (r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRecurrence(r)}
                  disabled={creating}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                    recurrence === r
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]"
                  }`}
                >
                  {RECURRENCE_LABELS[r]}
                </button>
              )
            )}
          </div>

          {recurrence !== "none" && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {recurrence === "weekly"
                ? "Resets every Monday."
                : "Resets on the 1st of each month."}
            </p>
          )}
        </div>

        {unit === "commits" && (
          <p className="text-xs text-[var(--muted-foreground)] rounded-lg bg-[var(--accent)]/10 px-3 py-2">
            ⚡ This goal will auto-update from your GitHub commit count each
            period.
          </p>
        )}

        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Creating...
            </>
          ) : (
            "Add goal"
          )}
        </button>

        {createError && (
          <p className="text-sm text-[var(--destructive)]">
            {createError}
          </p>
        )}
      </form>
    </div>
  );
}

function ConfettiBurst() {
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      color: string;
      rot: number;
      scale: number;
      speed: number;
    }>
  >([]);

  useEffect(() => {
    const colors = [
      "var(--accent)",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#EC4899",
    ];

    const newParticles: Array<{
      id: number;
      x: number;
      y: number;
      color: string;
      rot: number;
      scale: number;
      speed: number;
    }> = [];

    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 140;

      newParticles.push({
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance - 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 360 + 180,
        scale: 0.5 + Math.random() * 0.7,
        speed: 0.8 + Math.random() * 0.6,
      });
    }

    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-visible">
      <style>{`
        @keyframes confettiBurstAnim {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(0);
            opacity: 1;
          }

          50% {
            opacity: 1;
          }

          100% {
            transform:
              translate(var(--tx), var(--ty))
              rotate(var(--rot))
              scale(var(--scale));
            opacity: 0;
          }
        }
      `}</style>

      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2.5 h-2.5 rounded-sm"
          style={{
            backgroundColor: p.color,
            ["--tx" as string]: `${p.x}px`,
            ["--ty" as string]: `${p.y}px`,
            ["--rot" as string]: `${p.rot}deg`,
            ["--scale" as string]: p.scale,
            animation: `confettiBurstAnim ${p.speed}s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
          }}
        />
      ))}
    </div>
  );
}