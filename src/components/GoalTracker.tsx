"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useDashboardWidgetA11y } from "@/components/dashboard/DashboardWidgetA11yContext";
import { submitGoalWithRefresh } from "@/lib/goal-tracker";
import ConfirmModal from "@/components/ConfirmModal";
import { buildPublicGoalShareUrl } from "@/lib/goals/share";
import GoalHistory from "@/components/GoalHistory";
import EmptyState from "@/components/EmptyState";


type Recurrence = "none" | "weekly" | "monthly";

interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  recurrence: Recurrence;
  deadline: string | null;
  is_public: boolean;
  period_start: string;
  last_synced_at: string | null;
  week_start: string | null;
  last_period: {
    period_start: string;
    period_end: string;
    target: number;
    achieved: number;
    completed: boolean;
  } | null;
}

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
};

export function useGoalTracker() {
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
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [activeConfettiGoalId, setActiveConfettiGoalId] = useState<string | null>(null);
  const prevGoalsRef = useRef<Map<string, boolean>>(new Map());
  const initialLoadDoneRef = useRef<boolean>(false);

  const loadGoals = useCallback(async () => {
    const response = await fetch("/api/goals");
    if (!response.ok) {
      throw new Error(`Failed to load goals (HTTP ${response.status})`);
    }
    const data: { goals: Goal[] } = await response.json();
    const fetchedGoals = data.goals ?? [];
    setGoals(fetchedGoals);
    return fetchedGoals;
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/goals/sync", { method: "POST" });
      if (!res.ok) {
        // Read the body exactly once — the Fetch API body stream can only be
        // consumed once, so we must store the result before branching on status.
        let errData: { error?: string } = {};
        try {
          errData = await res.json();
        } catch (_) {}

        if (res.status === 429) {
          setSyncError(
            errData.error ?? "GitHub rate limit reached. Please try again later."
          );
        } else if (res.status === 401) {
          setSyncError("Unauthorized. Please log in again.");
        } else if (res.status === 502) {
          setSyncError(
            "GitHub sync failed: Expired token or missing repo scope."
          );
        } else {
          setSyncError(errData.error ?? "Sync failed. Please try again.");
        }
        return;
      }
      await loadGoals();
      setLastUpdated(new Date());
      setMinutesAgo(0);
    } catch (e) {
      setSyncError("Network error. Failed to sync goals.");
    } finally {
      setSyncing(false);
    }
  }, [loadGoals]);

  useEffect(() => {
    loadGoals()
      .then(async (fetchedGoals) => {
        const needsSync = fetchedGoals.some((g: Goal) => {
          // auto-sync applies to all goal types
          if (!g.last_synced_at) return true;
          const syncedAt = new Date(g.last_synced_at).getTime();
          return Date.now() - syncedAt > 15 * 60 * 1000;
        });
        if (needsSync) {
          await handleSync();
        }
      })
      .catch(() => {
        setSyncError("Failed to load goals. Please try again.");
      })
      .finally(() => {
        setLoading(false);
        setLastUpdated(new Date());
        setMinutesAgo(0);
      });
  }, [loadGoals, handleSync]);

  useEffect(() => {
    const handleSyncEvent = () => {
      loadGoals()
        .then(() => {
          setLastUpdated(new Date());
          setMinutesAgo(0);
        })
        .catch(() => {
          setSyncError("Failed to sync goals. Please try again.");
        });
    };
    window.addEventListener("devtrack:sync", handleSyncEvent);
    return () => window.removeEventListener("devtrack:sync", handleSyncEvent);
  }, [loadGoals]);

  async function handleCreate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setCreating(true);
    setCreateError(null);

    if (target <= 0) {
      setCreateError("Target must be greater than 0.");
      setCreating(false);
      return;
    }

    try {
      const result = await submitGoalWithRefresh({
        payload: { title, target, unit, recurrence, deadline: deadline || null },
        handleSync,
        loadGoals,
      });

      if (!result.created) {
        setCreateError(result.error);
        return;
      }

      setTitle("");
      setTarget(7);
      setUnit("commits");
      setRecurrence("none");
      setDeadline("");

      if (unit === "commits" || unit === "prs") {
        await handleSync();
      } else {
        await loadGoals().catch(() => {
          setSyncError("Failed to refresh goals after creation.");
        });
      }
    } catch (e) {
      setCreateError("Failed to create goal. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    const previousGoals = goals;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setConfirmingId(null);
    setDeletingId(id);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/goals/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setGoals(previousGoals);
        setDeleteError("Failed to delete goal. Please try again.");
      }
    } catch (e) {
      setGoals(previousGoals);
      setDeleteError("Failed to delete goal. Please check your connection.");
    } finally {
      setDeletingId(null);
    }
  }

  function getCompletionLabel(goal: Goal): string {
    if (goal.current >= goal.target) {
      if (goal.recurrence === "weekly") return "Completed this week ✓";
      if (goal.recurrence === "monthly") return "Completed this month ✓";
      return "Completed ✓";
    }

    if (goal.deadline) {
      const msLeft = new Date(goal.deadline).getTime() - Date.now();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) return "Overdue ⚠️";
      if (daysLeft === 0) return "Due today ⏳";
      return `${daysLeft}d left`;
    }

    return "";
  }

  useEffect(() => {
    if (goals.length === 0) return;

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
          typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          setActiveConfettiGoalId(g.id);
          setTimeout(() => {
            setActiveConfettiGoalId((curr) => (curr === g.id ? null : curr));
          }, 2500);
        }
      }

      prevGoalsRef.current.set(g.id, isCompleted);
    }
  }, [goals]);

  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
      setMinutesAgo(diff);
    }, 60000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return {
    goals,
    setGoals,
    loading,
    setLoading,
    syncing,
    syncError,
    setSyncError,
    lastUpdated,
    minutesAgo,
    title,
    setTitle,
    target,
    setTarget,
    unit,
    setUnit,
    recurrence,
    setRecurrence,
    deadline,
    setDeadline,
    creating,
    createError,
    confirmingId,
    setConfirmingId,
    deletingId,
    deleteError,
    setDeleteError,
    activeConfettiGoalId,
    handleSync,
    handleCreate,
    handleDelete,
    getCompletionLabel,
  };
}

export default function GoalTracker() {


  const {

    goals,
    setGoals,
    loading,
    syncing,
    syncError,
    setSyncError,
    lastUpdated,
    minutesAgo,
    title,
    setTitle,
    target,
    setTarget,
    unit,
    setUnit,
    recurrence,
    setRecurrence,
    deadline,
    setDeadline,
    creating,
    createError,
    confirmingId,
    setConfirmingId,
    deletingId,
    deleteError,
    setDeleteError,
    activeConfettiGoalId,
    handleSync,
    handleCreate,
    handleDelete,
    getCompletionLabel,
  } = useGoalTracker();

  const { setSummary, setIsUpdating } = useDashboardWidgetA11y("goal-tracker");

  useEffect(() => {
    setIsUpdating(loading);
  }, [loading, setIsUpdating]);

  useEffect(() => {
    const activeCount = goals.filter((goal) => goal.current < goal.target).length;
    const completedCount = goals.filter(
      (goal) => goal.current >= goal.target,
    ).length;
    setSummary(
      `${activeCount} active goal${activeCount === 1 ? "" : "s"}. ${completedCount} completed.`,
    );
  }, [goals, setSummary]);

  const { data: session } = useSession();

  const githubLogin =
    typeof (session as { githubLogin?: unknown } | null)?.githubLogin === "string"
      ? (session as { githubLogin: string }).githubLogin
      : null;

  const [copiedGoalId, setCopiedGoalId] = useState<string | null>(null);
  const [sharingGoalId, setSharingGoalId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const toggleGoalSharing = async (goalId: string, nextValue: boolean) => {
    setSharingGoalId(goalId);
    setShareError(null);

    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: nextValue }),
      });

      if (!response.ok) {
        setShareError("Failed to update goal sharing. Please try again.");
        return;
      }

      const data: { goal: Goal } = await response.json();

      setGoals((currentGoals) =>
        currentGoals.map((goal) => (goal.id === data.goal.id ? data.goal : goal))
      );
    } catch {
      setShareError("Failed to update goal sharing. Please check your connection.");
    } finally {
      setSharingGoalId(null);
    }
  };

  const copyGoalShareLink = async (goalId: string) => {
    if (!githubLogin) {
      setShareError("Unable to build share link for this account.");
      return;
    }

    const shareUrl = buildPublicGoalShareUrl(
      window.location.origin,
      githubLogin,
      goalId
    );

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedGoalId(goalId);
      window.setTimeout(() => {
        setCopiedGoalId((currentGoalId) =>
          currentGoalId === goalId ? null : currentGoalId
        );
      }, 2000);
    } catch {
      setShareError("Failed to copy share link. Please copy it manually.");
    }
  };

  const activeConfirmingGoal = goals.find((g) => g.id === confirmingId);

  if (loading) {
    return (
      <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading weekly goals</span>
          <div
            aria-hidden="true"
            className="mb-4 h-5 w-32 rounded bg-[var(--card-muted)] animate-pulse"
          />
          {[1, 2, 3].map((i) => (
            <div key={i} aria-hidden="true" className="mb-4">
              <div className="h-4 bg-[var(--card-muted)] rounded animate-pulse mb-2" />
              <div className="h-2 bg-[var(--card-muted)] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">Goals</h2>
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
            className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
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

      {/* Share Error */}
      {shareError && (
        <div className="mb-4 rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)] flex justify-between items-center">
          <p>{shareError}</p>
          <button
            type="button"
            onClick={() => setShareError(null)}
            className="text-[var(--destructive)] hover:opacity-80 ml-2"
            aria-label="Dismiss sharing error"
          >
            ✕
          </button>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="🎯"
            title="No goals yet"
            description="No goals yet. Create your first coding goal to start tracking progress!"
            actionLabel="Create Goal"
            actionHref="#create-goal-form"
          />

        </div>
      ) : (
        <ul className="space-y-4">

          {goals.map((goal) => {
            const pct = 
              goal.current > 0 && goal.target > 0 
                ? Math.max(
                  1, 
                  Math.min(Math.round((goal.current / goal.target) * 100), 100)
                  )
                : 0;
            const isDeleting = deletingId === goal.id;
            const completed = goal.current >= goal.target;
            const completionLabel = getCompletionLabel(goal);
            const isAutoSynced = goal.unit === "commits" || goal.unit === "prs";

            return (
              <li
                key={goal.id}
                className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
                tabIndex={0}
                aria-label={`Goal: ${goal.title}. ${goal.current} of ${goal.target} ${goal.unit}. ${getCompletionLabel(goal) || "In progress"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    // Focus the primary action button inside this card
                    const primaryBtn = e.currentTarget.querySelector<HTMLButtonElement>(
                      "button:not([disabled])"
                    );
                    primaryBtn?.click();
                  }
                }}
              >
                {activeConfettiGoalId === goal.id && <ConfettiBurst />}
                <div className="flex justify-between items-center text-sm mb-1">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[var(--card-foreground)]">{goal.title}</span>
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
                              ? `Last synced: ${new Date(goal.last_synced_at).toLocaleTimeString()}`
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
                    {completed ? (
                      <span className="text-xs font-medium text-emerald-500">
                        {completionLabel}
                      </span>
                    ) : completionLabel ? (
                      <span
                        className={`text-xs font-medium ${
                          completionLabel.includes("Overdue") ? "text-red-500" : "text-orange-500"
                        }`}
                      >
                        {completionLabel}
                      </span>
                    ) : null}
                    {goal.recurrence === "weekly" && goal.week_start && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Week: {(() => {
                          const start = new Date(goal.week_start);
                          const end = new Date(start);
                          end.setDate(start.getDate() + 6);
                          return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                        })()}
                      </span>
                    )}
                    {goal.last_period && (
                      <span
                        className={`text-xs font-medium ${
                          goal.last_period.completed
                            ? "text-emerald-500"
                            : "text-[var(--muted-foreground)]"
                        }`}
                        title={`Previous period ended ${new Date(
                          goal.last_period.period_end
                        ).toLocaleDateString()}`}
                      >
                        Last period: {goal.last_period.completed ? "✓" : "○"}{" "}
                        {goal.last_period.achieved}/{goal.last_period.target} {goal.unit}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[var(--muted-foreground)]">
                      {goal.current}/{goal.target} {goal.unit}
                    </span>

                    {!isAutoSynced && (
                      <button
                        onClick={async () => {
                          const newCurrent = goal.current + 1;
                          if (newCurrent > goal.target) return;
                          const res = await fetch(`/api/goals/${goal.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ current: newCurrent }),
                          });
                          if (res.ok) {
                            setGoals((prevGoals) =>
                              prevGoals.map((g) =>
                                g.id === goal.id ? { ...g, current: newCurrent } : g
                              )
                            );
                          }
                        }}
                        disabled={goal.current >= goal.target}
                        aria-label={`Increment "${goal.title}" progress by 1`}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        +1
                      </button>
                    )}

                    <button
                      type="button"
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
                          d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[var(--control)]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      completed ? "bg-emerald-500" : "bg-[var(--accent)]"
                    }`}
                    style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }}
                    role="progressbar"
                    aria-valuenow={goal.current}
                    aria-valuemin={0}
                    aria-valuemax={goal.target}
                    aria-label={`Goal progress: ${goal.current} of ${goal.target} ${goal.unit}`}
                  />
                </div>

                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--control)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--card-foreground)]">
                        Share this goal
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Make this goal visible on a public share page.
                      </p>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-[var(--card-foreground)]">
                      <input
                        type="checkbox"
                        checked={Boolean(goal.is_public)}
                        disabled={sharingGoalId === goal.id}
                        onChange={(event) =>
                          toggleGoalSharing(goal.id, event.currentTarget.checked)
                        }
                        aria-label={`Make "${goal.title}" public`}
                      />
                      Public
                    </label>
                  </div>

                  {goal.is_public && (
                    <button
                      type="button"
                      onClick={() => copyGoalShareLink(goal.id)}
                      className="secondary-button mt-3 rounded-lg px-3 py-1.5 text-sm"
                    >
                      {copiedGoalId === goal.id ? "Copied!" : "Copy share link"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {lastUpdated && (
        <p className="text-xs text-[var(--muted-foreground)] mt-2 text-right">
          {minutesAgo === 0 ? "Updated just now" : `Updated ${minutesAgo} min ago`}
        </p>
      )}

      {/* Goal Creation Form */}
      <form
        id="create-goal-form"
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
            onChange={(e) => setTitle(e.target.value)} maxLength={100}
            placeholder="Make 10 commits"
            required
            disabled={creating}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--accent)]"
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
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)]"
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
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)]"
            >
              <option value="commits">Commits ⚡</option>
              <option value="prs">PRs ⚡</option>
              <option value="hours">Hours</option>
              <option value="streak">Streak (days)</option>
              <option value="language">Lines of Code</option>
            </select>
          </div>
        </div>

        {recurrence === "none" && (
          <div>
            <label
              htmlFor="goal-deadline"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              Deadline (Optional)
            </label>
            <input
              id="goal-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={creating}
              min={new Date().toISOString().split("T")[0]}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)]"
            />
          </div>
        )}

        <div role="group" aria-labelledby="recurrence-label">
          <span
            id="recurrence-label"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            Recurrence
          </span>
          <div className="flex gap-2">
            {(["none", "weekly", "monthly"] as Recurrence[]).map((r) => (
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
            ))}
          </div>
          {recurrence !== "none" && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {recurrence === "weekly" ? "Resets every Monday." : "Resets on the 1st of each month."}
            </p>
          )}
        </div>

        {(unit === "commits" || unit === "prs") && (
          <p className="text-xs text-[var(--muted-foreground)] rounded-lg bg-[var(--accent)]/10 px-3 py-2">
            ⚡ This goal will auto-update from your GitHub activity.
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
              Creating Goal...
            </>
          ) : (
            "Create goal"
          )}
        </button>
        {createError && (
          <p className="text-sm text-[var(--destructive)]">{createError}</p>
        )}
      </form>

      {/* 🎯 Reusable Project Confirmation Overlay Component */}
      <ConfirmModal
        isOpen={confirmingId !== null}
        title="Delete Tracking Goal"
        message={`Are you sure you want to permanently remove your "${activeConfirmingGoal?.title || "active coding"}" goal? This will erase all gathered progress history numbers parameters.`}
        confirmLabel={deletingId ? "Deleting..." : "Permanently Delete"}
        cancelLabel="Keep Goal"
        onConfirm={() => {
          if (confirmingId) handleDelete(confirmingId);
        }}
        onCancel={() => setConfirmingId(null)}
      />

      {/* Goal History & Analytics */}
      <GoalHistory />
    </div>
  );
}

function ConfettiBurst() {
  const [particles, setParticles] = useState<Array<{
  id: number;
  x: number;
  y: number;
  color: string;
  rot: number;
  scale: number;
  speed: number;
}>>([]);

  useEffect(() => {
    const colors = ["var(--accent)", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
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
        color: colors[Math.random() * colors.length | 0],
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
            transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(var(--scale));
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
