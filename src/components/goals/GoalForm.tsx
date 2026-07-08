"use client";

import React, { useState, useEffect } from "react";
import { Goal, Recurrence } from "./GoalsSection";

interface GoalFormProps {
  initialData?: Goal | null;
  onSubmit: (data: { title: string; target: number; unit: string; recurrence: Recurrence; deadline: string | null }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default function GoalForm({ initialData, onSubmit, onCancel, isSubmitting }: GoalFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [target, setTarget] = useState(initialData?.target || 10);
  const [unit, setUnit] = useState(initialData?.unit || "commits");
  const [recurrence, setRecurrence] = useState<Recurrence>(initialData?.recurrence || "weekly");
  
  const initialDeadline = initialData?.deadline ? new Date(initialData.deadline).toISOString().split('T')[0] : "";
  const [deadline, setDeadline] = useState(initialDeadline);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setTarget(initialData.target);
      setUnit(initialData.unit);
      setRecurrence(initialData.recurrence);
      setDeadline(initialData.deadline ? new Date(initialData.deadline).toISOString().split('T')[0] : "");
    } else {
      setTitle("");
      setTarget(10);
      setUnit("commits");
      setRecurrence("weekly");
      setDeadline("");
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      target,
      unit,
      recurrence,
      deadline: deadline || null,
    });
  };

  const isAutoSynced = ["commits", "prs", "repositories", "streak"].includes(unit);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="goal-title" className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Goal title
        </label>
        <input
          id="goal-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="e.g. Master Open Source"
          required
          disabled={isSubmitting}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--accent)] outline-none"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="goal-target" className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Target
          </label>
          <input
            id="goal-target"
            type="number"
            min={1}
            max={10000}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)] outline-none"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="goal-unit" className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Unit
          </label>
          <select
            id="goal-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)] outline-none cursor-pointer"
          >
            <option value="commits">Commits ⚡</option>
            <option value="prs">Pull Requests ⚡</option>
            <option value="repositories">Repositories ⚡</option>
            <option value="streak">Streak (days) ⚡</option>
            <option value="hours">Hours</option>
          </select>
        </div>
      </div>

      <div role="group" aria-labelledby="recurrence-label">
        <span id="recurrence-label" className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Recurrence
        </span>
        <div className="flex gap-2">
          {(["none", "weekly", "monthly"] as Recurrence[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRecurrence(r)}
              disabled={isSubmitting}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all outline-none ${
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
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            {recurrence === "weekly" ? "Resets every Monday." : "Resets on the 1st of each month."}
          </p>
        )}
      </div>

      {recurrence === "none" && (
        <div>
          <label htmlFor="goal-deadline" className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Deadline (Optional)
          </label>
          <input
            id="goal-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={isSubmitting}
            min={new Date().toISOString().split("T")[0]}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)] outline-none"
          />
        </div>
      )}

      {isAutoSynced && (
        <div className="rounded-lg bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--accent)] flex items-center gap-2">
          <span>⚡</span>
          <span>This goal automatically syncs with your GitHub activity.</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--control)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !title.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent-foreground)]/30 border-t-[var(--accent-foreground)]" />
              Saving...
            </>
          ) : (
            initialData ? "Save Changes" : "Create Goal"
          )}
        </button>
      </div>
    </form>
  );
}
