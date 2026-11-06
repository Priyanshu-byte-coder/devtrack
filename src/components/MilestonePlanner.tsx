"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  Target,
  Plus,
  Trash2,
  Copy,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Milestone {
  id: string;
  title: string;
  description: string;
  target_value: number;
  current_value: number;
  unit: string;
  target_date: string;
  created_at: string;
  category: "commits" | "streak" | "projects" | "custom";
}

type MilestoneStatus = "completed" | "on-track" | "at-risk" | "behind";

const CATEGORY_OPTIONS = [
  { value: "commits", label: "Commits", icon: "📝" },
  { value: "streak", label: "Streak Days", icon: "🔥" },
  { value: "projects", label: "Projects", icon: "🚀" },
  { value: "custom", label: "Custom", icon: "🎯" },
];

function getStatus(milestone: Milestone): MilestoneStatus {
  const progress = milestone.current_value / milestone.target_value;
  if (progress >= 1) return "completed";

  const now = Date.now();
  const created = new Date(milestone.created_at).getTime();
  const target = new Date(milestone.target_date).getTime();
  const totalDuration = target - created;
  const elapsed = now - created;
  const expectedProgress = totalDuration > 0 ? elapsed / totalDuration : 0;

  if (now > target) return "behind";
  if (progress >= expectedProgress * 0.9) return "on-track";
  if (progress >= expectedProgress * 0.6) return "at-risk";
  return "behind";
}

function getForecastDate(milestone: Milestone): string | null {
  const { current_value, target_value, created_at } = milestone;
  if (current_value <= 0) return null;

  const elapsed = Date.now() - new Date(created_at).getTime();
  const rate = current_value / elapsed;
  const remaining = target_value - current_value;
  if (rate <= 0) return null;

  const msNeeded = remaining / rate;
  const forecastDate = new Date(Date.now() + msNeeded);
  return forecastDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<
  MilestoneStatus,
  { label: string; color: string; icon: ReactNode }
> = {
  completed: {
    label: "Completed",
    color: "#10b981",
    icon: <CheckCircle2 size={12} />,
  },
  "on-track": {
    label: "On track",
    color: "#6ba8ff",
    icon: <TrendingUp size={12} />,
  },
  "at-risk": {
    label: "At risk",
    color: "#f59e0b",
    icon: <AlertTriangle size={12} />,
  },
  behind: { label: "Behind", color: "#ef4444", icon: <Clock size={12} /> },
};

function StatusBadge({
  status,
  count,
}: {
  status: MilestoneStatus;
  count?: number;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 font-pixel text-[10px] uppercase tracking-[0.1em]"
      style={{ background: `${config.color}22`, color: config.color }}
    >
      {config.icon} {config.label}
      {count !== undefined && <span className="tabular-nums">× {count}</span>}
    </span>
  );
}

export default function MilestonePlanner() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    targetValue: "",
    currentValue: "0",
    unit: "",
    targetDate: "",
    category: "custom" as Milestone["category"],
  });

  const loadMilestones = useCallback(async () => {
    try {
      const res = await fetch("/api/milestones");
      if (!res.ok) return;
      const data = await res.json();
      setMilestones(data.milestones ?? []);
    } catch {
      // silently ignore network errors on initial load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  const handleAdd = useCallback(async () => {
    if (!form.title || !form.targetValue || !form.targetDate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          targetValue: Number(form.targetValue),
          currentValue: Number(form.currentValue) || 0,
          unit:
            form.unit ||
            CATEGORY_OPTIONS.find((c) => c.value === form.category)?.label ||
            "units",
          targetDate: form.targetDate,
          category: form.category,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error ?? "Failed to create milestone."
        );
        return;
      }
      const data = await res.json();
      setMilestones((prev) => [data.milestone, ...prev]);
      setForm({
        title: "",
        description: "",
        targetValue: "",
        currentValue: "0",
        unit: "",
        targetDate: "",
        category: "custom",
      });
      setShowForm(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleIncrement = useCallback(
    async (id: string) => {
      const milestone = milestones.find((m) => m.id === id);
      if (!milestone || milestone.current_value >= milestone.target_value)
        return;
      const next = milestone.current_value + 1;
      setMilestones((prev) =>
        prev.map((m) => (m.id === id ? { ...m, current_value: next } : m))
      );
      try {
        await fetch(`/api/milestones/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentValue: next }),
        });
      } catch {
        setMilestones((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, current_value: milestone.current_value } : m
          )
        );
      }
    },
    [milestones]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setMilestones((prev) => prev.filter((m) => m.id !== id));
      try {
        await fetch(`/api/milestones/${id}`, { method: "DELETE" });
      } catch {
        loadMilestones();
      }
    },
    [loadMilestones]
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      const milestone = milestones.find((m) => m.id === id);
      if (!milestone) return;
      try {
        const res = await fetch("/api/milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${milestone.title} (Copy)`,
            description: milestone.description,
            targetValue: milestone.target_value,
            currentValue: milestone.current_value,
            unit: milestone.unit,
            targetDate: milestone.target_date,
            category: milestone.category,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setMilestones((prev) => [data.milestone, ...prev]);
        }
      } catch {
        loadMilestones();
      }
    },
    [milestones, loadMilestones]
  );

  const statusCounts = milestones.reduce(
    (acc, m) => {
      acc[getStatus(m)] = (acc[getStatus(m)] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const fieldClass =
    "w-full border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";
  const labelClass = "mb-1 block text-xs text-[var(--muted-foreground)]";
  const iconButton =
    "inline-flex h-7 min-w-7 items-center justify-center border border-[var(--border)] px-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--control)] disabled:cursor-not-allowed disabled:opacity-40";
  const dueLabel = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="px-frame bg-[var(--card)] p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Target className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          <h2 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
            Milestone Planner
          </h2>
          {milestones.length > 0 && (
            <span className="bg-[var(--control)] px-2 py-0.5 font-pixel text-[10px] text-[var(--accent)]">
              {milestones.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          className="px-btn px-btn-sm"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add milestone
        </button>
      </div>

      {/* Summary chips */}
      {milestones.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <StatusBadge
              key={status}
              status={status as MilestoneStatus}
              count={count}
            />
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p role="alert" className="mb-3 text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}

      {/* Add form */}
      {showForm && (
        <div className="mb-4 border-2 border-dashed border-[var(--border)] p-4">
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="milestone-title" className={labelClass}>
                Title *
              </label>
              <input
                id="milestone-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Reach 500 commits"
                maxLength={100}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="milestone-category" className={labelClass}>
                Category
              </label>
              <select
                id="milestone-category"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as Milestone["category"],
                  }))
                }
                className={fieldClass}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="milestone-date" className={labelClass}>
                Target date *
              </label>
              <input
                id="milestone-date"
                type="date"
                value={form.targetDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetDate: e.target.value }))
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="milestone-target" className={labelClass}>
                Target value *
              </label>
              <input
                id="milestone-target"
                type="number"
                value={form.targetValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetValue: e.target.value }))
                }
                placeholder="100"
                min={1}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="milestone-current" className={labelClass}>
                Current value
              </label>
              <input
                id="milestone-current"
                type="number"
                value={form.currentValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currentValue: e.target.value }))
                }
                placeholder="0"
                min={0}
                className={fieldClass}
              />
            </div>
          </div>
          <div className="-m-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-btn px-btn-sm px-btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="px-btn px-btn-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add milestone"}
            </button>
          </div>
        </div>
      )}

      {/* Milestone list */}
      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          Loading milestones…
        </div>
      ) : milestones.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Target
            className="mb-2 h-8 w-8 text-[var(--muted-foreground)] opacity-40"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--muted-foreground)]">
            No milestones yet. Set a big target and track the climb.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {milestones.map((m) => {
            const status = getStatus(m);
            const pct = Math.min(
              Math.round((m.current_value / m.target_value) * 100),
              100
            );
            const forecast = getForecastDate(m);
            const isExpanded = expanded === m.id;
            const statusColor = STATUS_CONFIG[status].color;

            return (
              <li
                key={m.id}
                className="border border-[var(--border)] bg-[var(--background)] px-4 py-3.5"
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="text-lg" aria-hidden="true">
                    {CATEGORY_OPTIONS.find((c) => c.value === m.category)?.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {m.title}
                      </span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {m.current_value}/{m.target_value} {m.unit} · Due{" "}
                      {dueLabel(m.target_date)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleIncrement(m.id)}
                      disabled={status === "completed"}
                      aria-label={`Add 1 to ${m.title}`}
                      className={`${iconButton} font-pixel`}
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : m.id)}
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded
                          ? `Hide details for ${m.title}`
                          : `Show details for ${m.title}`
                      }
                      className={iconButton}
                    >
                      {isExpanded ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(m.id)}
                      aria-label={`Duplicate ${m.title}`}
                      title="Duplicate milestone"
                      className={iconButton}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      aria-label={`Delete ${m.title}`}
                      className={`${iconButton} border-transparent text-[var(--destructive)]`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Progress bar, segmented like the quest log */}
                <div
                  className="relative h-2.5 bg-[var(--control)]"
                  aria-hidden="true"
                >
                  <div
                    className="h-full transition-[width] duration-500"
                    style={{ width: `${pct}%`, background: statusColor }}
                  />
                  <span className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_10px,var(--background)_10px_12px)]" />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-[var(--muted-foreground)]">
                  <span>{pct}% complete</span>
                  {forecast && status !== "completed" && (
                    <span>Forecast: {forecast}</span>
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 bg-[var(--control)] p-2.5 text-xs text-[var(--muted-foreground)]">
                    {m.description && <p className="mb-1.5">{m.description}</p>}
                    <p>
                      Created: {new Date(m.created_at).toLocaleDateString()}
                    </p>
                    {status === "completed" && (
                      <p className="mt-1 font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--success)]">
                        ★ Milestone achieved
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
