"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useLocale, useTranslations } from "next-intl";
import { useDashboardWidgetA11y } from "@/components/dashboard/DashboardWidgetA11yContext";
import {
  filterGoals,
  shouldShowGoalFilters,
  submitGoalWithRefresh,
  type GoalStatusFilter,
} from "@/lib/goal-tracker";
import ConfirmModal from "@/components/ConfirmModal";
import { CopyFeedback } from "@/components/ui/copy-feedback";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { buildPublicGoalShareUrl } from "@/lib/goals/share";
import GoalHistory from "@/components/GoalHistory";
import WidgetSkeleton, { SkeletonBlock } from "./WidgetSkeleton";

type Recurrence = "none" | "weekly" | "monthly";
type GoalCategory = "side-project" | "work" | "dsa" | "open-source";

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
  category?: GoalCategory | null;
  last_period: {
    period_start: string;
    period_end: string;
    target: number;
    achieved: number;
    completed: boolean;
  } | null;
}

const RECURRENCE_KEYS: Record<Recurrence, "none" | "weekly" | "monthly"> = {
  none: "none",
  weekly: "weekly",
  monthly: "monthly",
};

const CATEGORY_KEYS: Record<
  GoalCategory,
  "sideProject" | "work" | "dsa" | "openSource"
> = {
  "side-project": "sideProject",
  work: "work",
  dsa: "dsa",
  "open-source": "openSource",
};

const CATEGORY_BADGE_CLASSES: Record<GoalCategory, string> = {
  "side-project": "bg-purple-500/10 text-purple-400 border-purple-500/30",
  work: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  dsa: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  "open-source": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const CATEGORY_OPTIONS: GoalCategory[] = [
  "side-project",
  "work",
  "dsa",
  "open-source",
];

const STATUS_FILTER_OPTIONS: {
  value: GoalStatusFilter;
  labelKey: "all" | "active" | "completed";
}[] = [
  { value: "all", labelKey: "all" },
  { value: "active", labelKey: "active" },
  { value: "completed", labelKey: "completed" },
];

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
  const [category, setCategory] = useState<GoalCategory | "">("");
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<GoalCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>("all");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [activeConfettiGoalId, setActiveConfettiGoalId] = useState<
    string | null
  >(null);
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
            errData.error ??
              "GitHub rate limit reached. Please try again later."
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
        payload: {
          title,
          target,
          unit,
          recurrence,
          deadline: deadline || null,
          category: category || null,
        },
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
      setCategory("");

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
      if (goal.current > goal.target) return "Goal surpassed! 🎯";
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
    category,
    setCategory,
    activeCategoryFilter,
    setActiveCategoryFilter,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
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
  const t = useTranslations("goals");
  const locale = useLocale();

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
    category,
    setCategory,
    activeCategoryFilter,
    setActiveCategoryFilter,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
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

  const getTranslatedCompletionLabel = useCallback(
    (goal: Goal): string => {
      if (goal.current >= goal.target) {
        if (goal.current > goal.target) return t("status.goalSurpassed");
        if (goal.recurrence === "weekly") return t("status.completedThisWeek");
        if (goal.recurrence === "monthly")
          return t("status.completedThisMonth");
        return t("status.completed");
      }

      if (goal.deadline) {
        const msLeft = new Date(goal.deadline).getTime() - Date.now();
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) return t("status.overdue");
        if (daysLeft === 0) return t("status.dueToday");
        return t("status.daysLeft", { days: daysLeft });
      }

      return "";
    },
    [t]
  );

  const { setSummary, setIsUpdating } = useDashboardWidgetA11y("goal-tracker");

  useEffect(() => {
    setIsUpdating(loading);
  }, [loading, setIsUpdating]);

  useEffect(() => {
    const activeCount = goals.filter(
      (goal) => goal.current < goal.target
    ).length;
    const completedCount = goals.filter(
      (goal) => goal.current >= goal.target
    ).length;
    setSummary(t("a11y.summary", { activeCount, completedCount }));
  }, [goals, setSummary, t]);

  const filterVisibility = shouldShowGoalFilters(goals);

  // Reset hidden controls so the list is never filtered by something the user
  // can no longer see.
  useEffect(() => {
    if (!filterVisibility.search) setSearchQuery("");
    if (!filterVisibility.status) setStatusFilter("all");
  }, [
    filterVisibility.search,
    filterVisibility.status,
    setSearchQuery,
    setStatusFilter,
  ]);

  const visibleGoals = filterGoals(goals, {
    query: filterVisibility.search ? searchQuery : "",
    status: filterVisibility.status ? statusFilter : "all",
    category: activeCategoryFilter,
  });

  const { data: session } = useSession();

  const githubLogin =
    typeof (session as { githubLogin?: unknown } | null)?.githubLogin ===
    "string"
      ? (session as { githubLogin: string }).githubLogin
      : null;

  const { copy: copyText, isCopied } = useCopyToClipboard();
  const [sharingGoalId, setSharingGoalId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  // Animate the progress bars from 0% when they first appear. Each bar
  // already has `transition-all duration-700`, but its width starts at the
  // final value, so it snaps instead of filling. This flips on after the
  // first render that shows goals, so the width change animates.
  const [barsAnimated, setBarsAnimated] = useState(false);
  useEffect(() => {
    if (goals.length > 0 && !barsAnimated) {
      setBarsAnimated(true);
    }
  }, [goals, barsAnimated]);

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
        setShareError(t("messages.updateSharingFailed"));
        return;
      }

      const data: { goal: Goal } = await response.json();

      setGoals((currentGoals) =>
        currentGoals.map((goal) =>
          goal.id === data.goal.id ? data.goal : goal
        )
      );
    } catch {
      setShareError(t("messages.updateSharingConnection"));
    } finally {
      setSharingGoalId(null);
    }
  };

  const copyGoalShareLink = async (goalId: string) => {
    if (!githubLogin) {
      setShareError(t("messages.unableToBuildShareLink"));
      return;
    }

    const shareUrl = buildPublicGoalShareUrl(
      window.location.origin,
      githubLogin,
      goalId
    );

    if (!(await copyText(shareUrl, goalId))) {
      setShareError(t("messages.copyShareLinkFailed"));
    }
  };

  const numberFormatter = new Intl.NumberFormat(locale);

  const getTranslatedCompletionLabel = (goal: Goal): string => {
    if (goal.current >= goal.target) {
      if (goal.current > goal.target) return t("status.goalSurpassed");
      if (goal.recurrence === "weekly") return t("status.completedThisWeek");
      if (goal.recurrence === "monthly") return t("status.completedThisMonth");
      return t("status.completed");
    }

    if (goal.deadline) {
      const msLeft = new Date(goal.deadline).getTime() - Date.now();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) return t("status.overdue");
      if (daysLeft === 0) return t("status.dueToday");
      return t("status.daysLeft", { days: daysLeft });
    }

    return "";
  };

  const activeConfirmingGoal = goals.find((g) => g.id === confirmingId);

  if (loading) {
    return (
      <WidgetSkeleton title={t("empty.loadingWeeklyGoals")} className="h-full">
        <div className="flex justify-between items-center mb-4">
          <SkeletonBlock className="h-[35px] w-16" />
          <SkeletonBlock className="h-[35px] w-20" />
        </div>
        <SkeletonBlock className="mb-3 h-[26px]" />
        <div aria-hidden="true">
          <SkeletonBlock className="h-4 w-full mb-2" />
          <SkeletonBlock className="h-[108px] w-full" />
        </div>
        <SkeletonBlock className="mt-2 h-4" />
        <SkeletonBlock className="mt-6 h-[440px]" />
        <SkeletonBlock className="mt-6 h-[37px]" />
      </WidgetSkeleton>
    );
  }

  return (
    <div className="h-full px-frame bg-[var(--card)] p-4 sm:p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p
            aria-hidden="true"
            className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]"
          >
            {t("sections.questLog")}
          </p>
          <h2 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
            {t("sections.goals")}
          </h2>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          title={t("actions.refreshCommitGoalsTitle")}
          aria-label={t("actions.refreshCommitGoalsAria")}
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
          {syncing ? t("actions.syncing") : t("actions.refresh")}
        </button>
      </div>

      {/* Sync Error */}
      {syncError && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-[var(--destructive)]">
          <span>⚠️ {syncError}</span>
          <button
            type="button"
            onClick={() => setSyncError(null)}
            className="text-[var(--destructive)] hover:opacity-70 font-semibold"
            aria-label={t("a11y.dismissErrorAria")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Delete Error */}
      {deleteError && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-[var(--destructive)] flex justify-between items-center">
          <p>{deleteError}</p>
          <button
            onClick={() => setDeleteError(null)}
            className="text-[var(--destructive)] hover:opacity-80 ml-2"
            aria-label={t("a11y.dismissErrorAria")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Share Error */}
      {shareError && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-[var(--destructive)] flex justify-between items-center">
          <p>{shareError}</p>
          <button
            type="button"
            onClick={() => setShareError(null)}
            className="text-[var(--destructive)] hover:opacity-80 ml-2"
            aria-label={t("a11y.dismissShareErrorAria")}
          >
            ✕
          </button>
        </div>
      )}

      {goals.length === 0 ? (
        // The create form sits right below, so a one-line hint beats a second call to action.
        <p className="mt-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
          {t("empty.noGoalsYet")}
        </p>
      ) : (
        <>
          {goals.some((g) => g.category) && (
            <div
              role="group"
              aria-label={t("a11y.filterByCategory")}
              className="mb-3 flex flex-wrap gap-1.5"
            >
              <button
                type="button"
                onClick={() => setActiveCategoryFilter(null)}
                aria-pressed={activeCategoryFilter === null}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  activeCategoryFilter === null
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]"
                }`}
              >
                {t("actions.all")}
              </button>
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setActiveCategoryFilter((curr) => (curr === c ? null : c))
                  }
                  aria-pressed={activeCategoryFilter === c}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    activeCategoryFilter === c
                      ? CATEGORY_BADGE_CLASSES[c].replace("/10", "/20")
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]"
                  }`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          )}

          {(filterVisibility.search || filterVisibility.status) && (
            <div className="mb-3 space-y-2">
              {filterVisibility.search && (
                <div className="relative">
                  <input
                    type="search"
                    name="search"
                    autoComplete="off"
                    spellCheck={false}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("empty.searchPlaceholder")}
                    aria-label={t("a11y.searchGoalsAria")}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-muted)] py-1.5 pl-3 pr-8 text-sm text-[var(--card-foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] [&::-webkit-search-cancel-button]:appearance-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label={t("a11y.clearSearchAria")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
              {filterVisibility.status && (
                <div
                  role="group"
                  aria-label={t("a11y.filterByStatus")}
                  className="flex flex-wrap gap-1.5"
                >
                  {STATUS_FILTER_OPTIONS.map(({ value, label }) => {
                    const statusLabel =
                      value === "all"
                        ? t("actions.all")
                        : value === "active"
                          ? t("actions.active")
                          : t("actions.completed");
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setStatusFilter(value)}
                        aria-pressed={statusFilter === value}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          statusFilter === value
                            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                            : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {statusLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {visibleGoals.length === 0 && (
            <p
              role="status"
              className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)]"
            >
              {t("empty.noGoalsMatchSearch")}
            </p>
          )}

          <ul className="space-y-4">
            {visibleGoals.map((goal) => {
              const pct =
                goal.current > 0 && goal.target > 0
                  ? Math.max(
                      1,
                      Math.min(
                        Math.round((goal.current / goal.target) * 100),
                        100
                      )
                    )
                  : 0;
              const progressWidth = Math.min(
                (goal.current / Math.max(goal.target, 1)) * 100,
                100
              );
              const isDeleting = deletingId === goal.id;
              const completed = goal.current >= goal.target;
              const isSurpassed = goal.current > goal.target;
              const completionLabel = getTranslatedCompletionLabel(goal);
              const isAutoSynced =
                goal.unit === "commits" || goal.unit === "prs";

              return (
                <li
                  key={goal.id}
                  className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
                  tabIndex={0}
                  aria-label={t("a11y.goalLabel", {
                    title: goal.title,
                    current: numberFormatter.format(goal.current),
                    target: numberFormatter.format(goal.target),
                    unit: goal.unit,
                    status: completionLabel || t("a11y.inProgress"),
                  })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      // Focus the primary action button inside this card
                      const primaryBtn =
                        e.currentTarget.querySelector<HTMLButtonElement>(
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
                        <span className="text-[var(--card-foreground)]">
                          {goal.title}
                        </span>
                        {goal.category && (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${CATEGORY_BADGE_CLASSES[goal.category]}`}
                          >
                            {t(`categories.${CATEGORY_KEYS[goal.category]}`)}
                          </span>
                        )}
                        {goal.recurrence !== "none" && (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                              goal.recurrence === "weekly"
                                ? "bg-accent/10 text-[var(--accent)] border-accent/30"
                                : "bg-[var(--card-muted)] text-[var(--muted-foreground)] border-[var(--border)]"
                            }`}
                          >
                            {t(
                              `recurrence.${RECURRENCE_KEYS[goal.recurrence]}`
                            )}
                          </span>
                        )}
                        {isAutoSynced && (
                          <span
                            title={
                              goal.last_synced_at
                                ? t("status.lastSynced", {
                                    time: new Date(
                                      goal.last_synced_at
                                    ).toLocaleTimeString(locale),
                                  })
                                : t("status.autoSyncedTooltip")
                            }
                            className="inline-flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]"
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
                            {t("status.autoSyncedBadge")}
                          </span>
                        )}
                      </div>
                      {completed ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                          <span className="bg-emerald-500/15 px-1.5 py-0.5 font-pixel text-[10px] uppercase tracking-[0.12em]">
                            {t("status.questComplete")}
                          </span>
                          {completionLabel}
                        </span>
                      ) : completionLabel ? (
                        <span
                          className={`text-xs font-medium ${
                            completionLabel.includes("Overdue") ||
                            completionLabel.includes("Atrasado") ||
                            completionLabel.includes("देरी")
                              ? "text-red-500"
                              : "text-orange-500"
                          }`}
                        >
                          {completionLabel}
                        </span>
                      ) : null}
                      {goal.recurrence === "weekly" && goal.week_start && (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {(() => {
                            const start = new Date(goal.week_start);
                            const end = new Date(start);
                            end.setDate(start.getDate() + 6);
                            const dFormat = new Intl.DateTimeFormat(locale, {
                              month: "short",
                              day: "numeric",
                            });
                            return t("status.weekLabel", {
                              start: dFormat.format(start),
                              end: dFormat.format(end),
                            });
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
                          ).toLocaleDateString(locale)}`}
                        >
                          {t("status.lastPeriod", {
                            symbol: goal.last_period.completed ? "✓" : "○",
                            achieved: numberFormatter.format(
                              goal.last_period.achieved
                            ),
                            target: numberFormatter.format(
                              goal.last_period.target
                            ),
                            unit: goal.unit,
                          })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[var(--muted-foreground)]">
                        {numberFormatter.format(goal.current)}/
                        {numberFormatter.format(goal.target)} {goal.unit}
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
                                  g.id === goal.id
                                    ? { ...g, current: newCurrent }
                                    : g
                                )
                              );
                            }
                          }}
                          disabled={goal.current >= goal.target}
                          aria-label={t("a11y.incrementProgressAria", {
                            title: goal.title,
                          })}
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
                        aria-label={t("a11y.deleteGoalAria", {
                          title: goal.title,
                        })}
                        title={t("actions.deleteGoal")}
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

                  <div
                    className={`relative h-3 overflow-hidden bg-[var(--control)] ${isSurpassed ? "ring-1 ring-emerald-500/40" : ""}`}
                  >
                    {/* Notches split the bar into pixel segments. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-10 bg-[repeating-linear-gradient(90deg,transparent_0_10px,var(--card)_10px_12px)]"
                    />
                    <div
                      className={`h-full transition-[width] duration-700 motion-reduce:transition-none ${
                        isSurpassed
                          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                          : completed
                            ? "bg-emerald-500"
                            : "bg-[var(--accent)]"
                      }`}
                      style={{
                        width: `${barsAnimated ? Math.max(0, Math.min(progressWidth, 100)) : 0}%`,
                      }}
                      role="progressbar"
                      aria-valuenow={goal.current}
                      aria-valuemin={0}
                      aria-valuemax={goal.target}
                      aria-label={t("a11y.goalProgress", {
                        current: numberFormatter.format(goal.current),
                        target: numberFormatter.format(goal.target),
                        unit: goal.unit,
                      })}
                    />
                  </div>

                  <div className="mt-3 border border-[var(--border)] bg-[var(--control)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--card-foreground)]">
                          {t("form.shareThisGoalTitle")}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {t("form.shareThisGoalDesc")}
                        </p>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-[var(--card-foreground)]">
                        <input
                          type="checkbox"
                          name="is_public"
                          checked={Boolean(goal.is_public)}
                          disabled={sharingGoalId === goal.id}
                          onChange={(event) =>
                            toggleGoalSharing(
                              goal.id,
                              event.currentTarget.checked
                            )
                          }
                          aria-label={t("a11y.makePublicAria", {
                            title: goal.title,
                          })}
                        />
                        {t("actions.public")}
                      </label>
                    </div>

                    {goal.is_public && (
                      <button
                        type="button"
                        onClick={() => copyGoalShareLink(goal.id)}
                        className="secondary-button mt-3 rounded-lg px-3 py-1.5 text-sm"
                      >
                        <CopyFeedback
                          copied={isCopied(goal.id)}
                          label={t("actions.copyShareLink")}
                        />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {lastUpdated && (
        <p className="text-xs text-[var(--muted-foreground)] mt-2 text-right">
          {minutesAgo === 0
            ? t("messages.updatedJustNow")
            : t("messages.updatedMinAgo", { minutes: minutesAgo })}
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
            {t("form.goalTitleLabel")}
          </label>
          <input
            id="goal-title"
            name="title"
            type="text"
            autoComplete="off"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder={t("form.goalTitlePlaceholder")}
            required
            disabled={creating}
            aria-label="Goal title"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--accent)]"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label
              htmlFor="goal-target"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              {t("form.targetLabel")}
            </label>
            <input
              id="goal-target"
              name="target"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              min={1}
              max={10000}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              disabled={creating}
              aria-label="Target"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)]"
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor="goal-unit"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              {t("form.unitLabel")}
            </label>
            <select
              id="goal-unit"
              name="unit"
              aria-label="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={creating}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)]"
            >
              <option value="commits">{t("units.commits")}</option>
              <option value="prs">{t("units.prs")}</option>
              <option value="hours">{t("units.hours")}</option>
              <option value="streak">{t("units.streak")}</option>
              <option value="language">{t("units.language")}</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="goal-category"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            {t("categories.categoryLabel")}
          </label>
          <select
            id="goal-category"
            name="category"
            aria-label="Category (Optional)"
            value={category}
            onChange={(e) => setCategory(e.target.value as GoalCategory | "")}
            disabled={creating}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)]"
          >
            <option value="">{t("categories.noCategory")}</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        {recurrence === "none" && (
          <div>
            <label
              htmlFor="goal-deadline"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
            >
              {t("form.deadlineLabel")}
            </label>
            <input
              id="goal-deadline"
              name="deadline"
              type="date"
              autoComplete="off"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={creating}
              min={new Date().toISOString().split("T")[0]}
              aria-label="Deadline (Optional)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)]"
            />
          </div>
        )}

        <div role="group" aria-labelledby="recurrence-label">
          <span
            id="recurrence-label"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            {t("recurrence.recurrenceLabel")}
          </span>
          <div className="flex gap-2">
            {(["none", "weekly", "monthly"] as Recurrence[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRecurrence(r)}
                disabled={creating}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                  recurrence === r
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]"
                }`}
              >
                {t(`recurrence.${RECURRENCE_KEYS[r]}`)}
              </button>
            ))}
          </div>
          {recurrence !== "none" && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {recurrence === "weekly"
                ? t("recurrence.resetsWeekly")
                : t("recurrence.resetsMonthly")}
            </p>
          )}
        </div>

        {(unit === "commits" || unit === "prs") && (
          <p className="text-xs text-[var(--muted-foreground)] rounded-lg bg-accent/10 px-3 py-2">
            {t("form.autoUpdateNotice")}
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
              {t("actions.creatingGoal")}
            </>
          ) : (
            t("actions.createGoal")
          )}
        </button>
        {createError && (
          <p className="text-sm text-[var(--destructive)]">{createError}</p>
        )}
      </form>

      {/* 🎯 Reusable Project Confirmation Overlay Component */}
      <ConfirmModal
        isOpen={confirmingId !== null}
        title={t("messages.deleteConfirmTitle")}
        message={t("messages.deleteConfirmMessage", {
          title: activeConfirmingGoal?.title || "active coding",
        })}
        confirmLabel={
          deletingId ? t("actions.deleting") : t("actions.permanentlyDelete")
        }
        cancelLabel={t("actions.keepGoal")}
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
        color: colors[(Math.random() * colors.length) | 0],
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
