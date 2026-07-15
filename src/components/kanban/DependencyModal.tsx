"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

interface Task {
  id: string;
  project_id: string;
  stage_id: string;
  title: string;
  description: string;
  position: number;
}

interface Dependency {
  id: string;
  project_id: string;
  blocked_task_id: string;
  blocking_task_id: string;
}

interface DependencyModalProps {
  task: Task;
  tasks: Task[];
  dependencies: Dependency[];
  projectId: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export default function DependencyModal({
  task,
  tasks,
  dependencies,
  projectId,
  onClose,
  onRefresh,
}: DependencyModalProps) {
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Blockers: tasks that are blocking this task (blocking_task_id)
  const blockers = dependencies
    .filter((d) => d.blocked_task_id === task.id)
    .map((d) => tasks.find((t) => t.id === d.blocking_task_id))
    .filter(Boolean) as Task[];

  // Blocked: tasks that this task is blocking (blocked_task_id)
  const blockedTasks = dependencies
    .filter((d) => d.blocking_task_id === task.id)
    .map((d) => tasks.find((t) => t.id === d.blocked_task_id))
    .filter(Boolean) as Task[];

  // Eligible tasks to add as blocker: other tasks in the project not already blocking this task, and not itself
  const blockerIds = blockers.map((b) => b.id);
  const eligibleTasks = tasks.filter(
    (t) => t.id !== task.id && !blockerIds.includes(t.id) && t.id !== task.id
  );

  const handleAddDependency = async () => {
    if (!selectedTaskId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/kanban/${projectId}/tasks/${task.id}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockingTaskId: selectedTaskId }),
      });
      if (!res.ok) throw new Error("Failed to add dependency");
      setSelectedTaskId("");
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveDependency = async (blockingId: string) => {
    try {
      const res = await fetch(
        `/api/kanban/${projectId}/tasks/${task.id}/dependencies?blockingTaskId=${blockingId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove dependency");
      await onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div>
            <h3 className="text-base font-bold text-[var(--card-foreground)]">
              Manage Dependencies
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] truncate max-w-[300px]">
              For: {task.title}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Add Blocker Form */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--muted-foreground)]">
            Add Blocker Task
          </label>
          <div className="flex gap-2">
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">Select a task...</option>
              {eligibleTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddDependency}
              disabled={submitting || !selectedTaskId}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Blockers list */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)] pb-1">
            Blocked By (Blockers)
          </h4>
          {blockers.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)] italic">This task is not blocked.</p>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {blockers.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--control)]/40 p-2 text-xs"
                >
                  <span className="font-semibold text-[var(--foreground)] truncate flex-1">
                    {b.title}
                  </span>
                  <button
                    onClick={() => handleRemoveDependency(b.id)}
                    className="text-[var(--muted-foreground)] hover:text-red-500 rounded p-1 hover:bg-red-500/10"
                    title="Remove dependency"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blocking list */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)] pb-1">
            Blocking Tasks
          </h4>
          {blockedTasks.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)] italic">This task is not blocking other tasks.</p>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {blockedTasks.map((bt) => (
                <div
                  key={bt.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--control)]/40 p-2 text-xs font-semibold text-[var(--foreground)] truncate"
                >
                  {bt.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
