"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Filter, Calendar, RefreshCw } from "lucide-react";

interface Activity {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: {
    title?: string;
    name?: string;
    stage_name?: string;
    count?: number;
    id?: string;
  };
  created_at: string;
}

interface ActivityFeedProps {
  projectId: string;
  refreshTrigger: number;
}

const ACTION_LABELS: Record<string, string> = {
  task_created: "Task Created",
  task_moved: "Task Moved",
  task_updated: "Task Updated",
  task_deleted: "Task Deleted",
  stage_created: "Column Created",
  stage_deleted: "Column Deleted",
  stages_reordered: "Columns Reordered",
};

export default function ActivityFeed({ projectId, refreshTrigger }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Filters
  const [actionType, setActionType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const limit = 15;

  const loadActivities = useCallback(async (isInitial = true) => {
    if (isInitial) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isInitial ? 0 : offset;
      let url = `/api/kanban/${projectId}/activity?limit=${limit}&offset=${currentOffset}`;
      if (actionType) url += `&actionType=${actionType}`;
      if (dateFrom) url += `&dateFrom=${new Date(dateFrom).toISOString()}`;
      if (dateTo) url += `&dateTo=${new Date(dateTo).toISOString()}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load activity logs");
      const data = await res.json();
      const fetched: Activity[] = data.activities || [];

      if (isInitial) {
        setActivities(fetched);
      } else {
        setActivities((prev) => [...prev, ...fetched]);
      }

      setHasMore(fetched.length === limit);
      setOffset(currentOffset + fetched.length);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [projectId, actionType, dateFrom, dateTo, offset]);

  useEffect(() => {
    loadActivities(true);
  }, [projectId, actionType, dateFrom, dateTo, refreshTrigger]);

  const getActivityMessage = (activity: Activity) => {
    const meta = activity.metadata;
    switch (activity.action) {
      case "task_created":
        return (
          <span>
            created task <strong className="text-[var(--foreground)]">{meta.title}</strong>
          </span>
        );
      case "task_moved":
        return (
          <span>
            moved task <strong className="text-[var(--foreground)]">{meta.title}</strong> to <strong className="text-[var(--accent)]">{meta.stage_name}</strong>
          </span>
        );
      case "task_updated":
        return (
          <span>
            updated task <strong className="text-[var(--foreground)]">{meta.title}</strong>
          </span>
        );
      case "task_deleted":
        return (
          <span>
            deleted task <strong className="text-[var(--foreground)]">{meta.title}</strong>
          </span>
        );
      case "stage_created":
        return (
          <span>
            created column <strong className="text-[var(--foreground)]">{meta.name}</strong>
          </span>
        );
      case "stage_deleted":
        return (
          <span>
            deleted a column
          </span>
        );
      case "stages_reordered":
        return (
          <span>
            reordered board columns
          </span>
        );
      default:
        return <span>performed an action</span>;
    }
  };

  const getActionIconColor = (action: string) => {
    switch (action) {
      case "task_created":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "task_deleted":
      case "stage_deleted":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "task_moved":
      case "stages_reordered":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
      default:
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--card)] text-[var(--foreground)]">
      {/* Filters header */}
      <div className="border-b border-[var(--border)] p-4 bg-[var(--control)]/45 space-y-3 rounded-t-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--foreground)]">
            <Clock size={16} /> Activity History
          </h3>
          <button
            onClick={() => loadActivities(true)}
            className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--control)] hover:text-[var(--foreground)] transition-colors"
            title="Refresh feed"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Action filter */}
          <div className="relative">
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] py-1.5 pl-2 pr-6 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none appearance-none"
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            <Filter size={12} className="absolute right-2.5 top-2.5 text-[var(--muted-foreground)] pointer-events-none" />
          </div>

          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
            placeholder="From"
          />

          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
            placeholder="To"
          />
        </div>
      </div>

      {/* Timeline items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-[300px]">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-500">
            Error: {error}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center text-xs text-[var(--muted-foreground)] py-12">
            No activity matches the filters.
          </div>
        ) : (
          <div className="relative border-l-2 border-[var(--border)] pl-4 ml-3 space-y-6">
            {activities.map((activity) => (
              <div key={activity.id} className="relative group">
                {/* Timeline Dot Icon */}
                <span
                  className={`absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold shadow-sm transition-transform group-hover:scale-110 ${getActionIconColor(
                    activity.action
                  )}`}
                >
                  {activity.action.startsWith("task") ? "T" : "C"}
                </span>

                {/* Content */}
                <div className="space-y-1">
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                    {getActivityMessage(activity)}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] opacity-60">
                    <Calendar size={10} />
                    {new Date(activity.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {hasMore && !loading && (
        <div className="p-3 border-t border-[var(--border)] bg-[var(--control)]/20 text-center">
          <button
            onClick={() => loadActivities(false)}
            disabled={loadingMore}
            className="text-xs font-semibold text-[var(--accent)] hover:underline disabled:opacity-50"
          >
            {loadingMore ? "Loading more..." : "Load More Activities"}
          </button>
        </div>
      )}
    </div>
  );
}
