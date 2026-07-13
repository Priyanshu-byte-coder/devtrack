"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Task {
  id: string;
  title: string;
  created_at: string;
  totalMinutes: number;
}

interface TimeEntry {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
}

interface ActiveTimer {
  taskId: string;
  startedAt: string; // ISO 8601
}

const ACTIVE_TIMER_STORAGE_KEY = "devtrack_active_timer";

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatElapsed(startedAt: string, nowMs: number): string {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((nowMs - new Date(startedAt).getTime()) / 1000)
  );
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

function readStoredTimer(): ActiveTimer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_TIMER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveTimer;
    if (!parsed.taskId || !parsed.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredTimer(timer: ActiveTimer | null) {
  if (typeof window === "undefined") return;
  if (timer) {
    window.localStorage.setItem(ACTIVE_TIMER_STORAGE_KEY, JSON.stringify(timer));
  } else {
    window.localStorage.removeItem(ACTIVE_TIMER_STORAGE_KEY);
  }
}

export default function TaskTimeTracker() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [now, setNow] = useState(Date.now());
  const stoppingRef = useRef(false);

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [entriesByTask, setEntriesByTask] = useState<Record<string, TimeEntry[]>>({});
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [confirmingEntryId, setConfirmingEntryId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const response = await fetch("/api/tasks");
    const data: { tasks: Task[] } = await response.json();
    setTasks(data.tasks ?? []);
  }, []);

  // Resume a timer that was running before a page refresh.
  useEffect(() => {
    setActiveTimer(readStoredTimer());
    loadTasks()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadTasks]);

  // Tick every second while a timer is running so the elapsed display updates.
  useEffect(() => {
    if (!activeTimer) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  const stopActiveTimer = useCallback(async () => {
    if (!activeTimer || stoppingRef.current) return;
    stoppingRef.current = true;

    const { taskId, startedAt } = activeTimer;
    const endedAt = new Date().toISOString();

    setActiveTimer(null);
    writeStoredTimer(null);

    try {
      await fetch(`/api/tasks/${taskId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt, endedAt }),
      });
      await loadTasks().catch(() => {});
      if (expandedTaskId === taskId) {
        await loadEntriesForTask(taskId).catch(() => {});
      }
    } finally {
      stoppingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTimer, loadTasks, expandedTaskId]);

  async function startTimer(taskId: string) {
    if (activeTimer) {
      await stopActiveTimer();
    }
    const timer: ActiveTimer = { taskId, startedAt: new Date().toISOString() };
    setActiveTimer(timer);
    writeStoredTimer(timer);
    setNow(Date.now());
  }

  async function loadEntriesForTask(taskId: string) {
    setEntriesLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/time-entries`);
      const data: { entries: TimeEntry[] } = await response.json();
      setEntriesByTask((prev) => ({ ...prev, [taskId]: data.entries ?? [] }));
    } finally {
      setEntriesLoading(false);
    }
  }

  async function toggleLogPanel(taskId: string) {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      return;
    }
    setExpandedTaskId(taskId);
    if (!entriesByTask[taskId]) {
      await loadEntriesForTask(taskId).catch(() => {});
    }
  }

  async function handleDeleteEntry(taskId: string, entryId: string) {
    const previous = entriesByTask[taskId] ?? [];
    setEntriesByTask((prev) => ({
      ...prev,
      [taskId]: previous.filter((e) => e.id !== entryId),
    }));
    setConfirmingEntryId(null);
    setDeletingEntryId(entryId);

    try {
      const res = await fetch(`/api/time-entries/${entryId}`, { method: "DELETE" });
      if (!res.ok) {
        setEntriesByTask((prev) => ({ ...prev, [taskId]: previous }));
      } else {
        await loadTasks().catch(() => {});
      }
    } catch {
      setEntriesByTask((prev) => ({ ...prev, [taskId]: previous }));
    } finally {
      setDeletingEntryId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle }),
      });

      if (!response.ok) {
        throw new Error("Failed to create task");
      }
    } catch {
      setCreateError("Failed to create task. Please try again.");
      setCreating(false);
      return;
    }

    setNewTaskTitle("");
    await loadTasks().catch(() => {});
    setCreating(false);
  }

  async function handleDeleteTask(id: string) {
    if (activeTimer?.taskId === id) {
      await stopActiveTimer();
    }

    const previousTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setConfirmingId(null);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setTasks(previousTasks);
      }
    } catch {
      setTasks(previousTasks);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="mb-4 h-5 w-32 rounded bg-[var(--card-muted)] animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-4 h-10 rounded bg-[var(--card-muted)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">Time Tracking</h2>

      {tasks.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No tasks yet. Add one below to start tracking time.
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => {
            const isRunning = activeTimer?.taskId === task.id;
            const isConfirming = confirmingId === task.id;
            const isDeleting = deletingId === task.id;
            const isExpanded = expandedTaskId === task.id;
            const entries = entriesByTask[task.id] ?? [];

            return (
              <li key={task.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--card-foreground)]">{task.title}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {isRunning
                        ? formatElapsed(activeTimer.startedAt, now)
                        : formatDuration(task.totalMinutes)}{" "}
                      logged
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => (isRunning ? stopActiveTimer() : startTimer(task.id))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        isRunning
                          ? "bg-red-500 text-white hover:opacity-90"
                          : "bg-[var(--accent)] text-white hover:opacity-90"
                      }`}
                      aria-label={isRunning ? `Stop timer for ${task.title}` : `Start timer for ${task.title}`}
                    >
                      {isRunning ? "Stop" : "Start"}
                    </button>

                    <button
                      onClick={() => toggleLogPanel(task.id)}
                      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] transition-colors"
                      aria-label={`${isExpanded ? "Hide" : "Show"} session history for ${task.title}`}
                    >
                      {isExpanded ? "Hide log" : "Log"}
                    </button>

                    {isConfirming ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          disabled={isDeleting}
                          className="text-red-400 hover:text-red-300 font-semibold transition-colors disabled:opacity-50"
                          aria-label={`Confirm delete task: ${task.title}`}
                        >
                          Yes
                        </button>
                        <span className="text-[var(--muted-foreground)]">/</span>
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
                        onClick={() => setConfirmingId(task.id)}
                        disabled={isDeleting}
                        className="text-[var(--muted-foreground)] hover:text-red-400 transition-colors disabled:opacity-50"
                        aria-label={`Delete task: ${task.title}`}
                        title="Delete task"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 border-t border-[var(--border)] pt-3">
                    {entriesLoading && !entriesByTask[task.id] ? (
                      <p className="text-xs text-[var(--muted-foreground)]">Loading sessions...</p>
                    ) : entries.length === 0 ? (
                      <p className="text-xs text-[var(--muted-foreground)]">No sessions logged yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {entries.map((entry) => (
                          <li key={entry.id} className="flex items-center justify-between text-xs">
                            <span className="text-[var(--muted-foreground)]">
                              {new Date(entry.started_at).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}{" "}
                              &middot; {formatDuration(entry.duration_minutes)}
                            </span>
                            {confirmingEntryId === entry.id ? (
                              <span className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteEntry(task.id, entry.id)}
                                  disabled={deletingEntryId === entry.id}
                                  className="text-red-400 hover:text-red-300 font-semibold transition-colors disabled:opacity-50"
                                  aria-label="Confirm delete session"
                                >
                                  Yes
                                </button>
                                <span className="text-[var(--muted-foreground)]">/</span>
                                <button
                                  onClick={() => setConfirmingEntryId(null)}
                                  className="text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] transition-colors"
                                  aria-label="Cancel delete session"
                                >
                                  No
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmingEntryId(entry.id)}
                                className="text-[var(--muted-foreground)] hover:text-red-400 transition-colors"
                                aria-label="Delete session"
                              >
                                Delete
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleCreate} className="mt-6 flex gap-2 border-t border-[var(--border)] pt-4">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a task to track"
          required
          disabled={creating}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={creating || !newTaskTitle.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            "Add"
          )}
        </button>
      </form>

      {createError && <p className="mt-2 text-sm text-red-500">{createError}</p>}
    </div>
  );
}
