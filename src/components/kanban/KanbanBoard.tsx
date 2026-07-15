"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Plus, Settings, Sparkles } from "lucide-react";
import KanbanColumn from "./KanbanColumn";
import StageSettingsModal from "./StageSettingsModal";
import KanbanTaskCard from "./KanbanTaskCard";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Task {
  id: string;
  project_id: string;
  stage_id: string;
  title: string;
  description: string;
  position: number;
}

interface KanbanBoardProps {
  projectId: string;
}

export default function KanbanBoard({ projectId }: KanbanBoardProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals / forms state
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormStageId, setTaskFormStageId] = useState<string | null>(null);
  const [taskFormTask, setTaskFormTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");

  // Drag overlays
  const [activeColumn, setActiveColumn] = useState<Stage | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/kanban/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project details");
      const data = await res.json();
      setStages(data.stages || []);
      setTasks(data.tasks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleSaveStages = async (updatedStages: Stage[], deleteStageId?: string) => {
    try {
      const res = await fetch(`/api/kanban/${projectId}/stages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: updatedStages, deleteStageId }),
      });
      if (!res.ok) throw new Error("Failed to save stages configuration");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    try {
      if (taskFormTask) {
        // Edit existing task
        const updatedTasks = tasks.map((t) =>
          t.id === taskFormTask.id ? { ...t, title: taskTitle, description: taskDesc } : t
        );
        const res = await fetch(`/api/kanban/${projectId}/tasks`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: updatedTasks }),
        });
        if (!res.ok) throw new Error("Failed to update task");
      } else {
        // Create new task
        const stageId = taskFormStageId!;
        const stageTasks = tasks.filter((t) => t.stage_id === stageId);
        const res = await fetch(`/api/kanban/${projectId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskTitle,
            description: taskDesc,
            stageId,
            position: stageTasks.length,
          }),
        });
        if (!res.ok) throw new Error("Failed to create task");
      }
      setTaskTitle("");
      setTaskDesc("");
      setShowTaskForm(false);
      setTaskFormTask(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetch(`/api/kanban/${projectId}/tasks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteTaskId: taskId }),
      });
      if (!res.ok) throw new Error("Failed to delete task");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id.toString();

    // Check if dragging a column
    const column = stages.find((s) => s.id === activeId);
    if (column) {
      setActiveColumn(column);
      return;
    }

    // Otherwise dragging a task
    const task = tasks.find((t) => t.id === activeId);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    if (activeId === overId) return;

    // Check if we are dragging a task
    const isActiveTask = tasks.some((t) => t.id === activeId);
    if (!isActiveTask) return;

    // Determine target column and position
    let targetStageId = overId;
    const isOverTask = tasks.some((t) => t.id === overId);

    if (isOverTask) {
      const overTask = tasks.find((t) => t.id === overId);
      targetStageId = overTask!.stage_id;
    } else {
      const overColumn = stages.some((s) => s.id === overId);
      if (!overColumn) return;
    }

    // Move task in local state visually for snappy feedback
    setTasks((prevTasks) => {
      const activeIdx = prevTasks.findIndex((t) => t.id === activeId);
      const activeTaskItem = prevTasks[activeIdx];

      if (activeTaskItem.stage_id !== targetStageId) {
        // Change stage
        const updated = [...prevTasks];
        updated[activeIdx] = { ...activeTaskItem, stage_id: targetStageId };
        return updated;
      }

      return prevTasks;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveColumn(null);
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    // 1. Column reordering
    if (activeColumn) {
      if (activeId !== overId) {
        const oldIndex = stages.findIndex((s) => s.id === activeId);
        const newIndex = stages.findIndex((s) => s.id === overId);

        const reorderedStages = arrayMove(stages, oldIndex, newIndex).map((s, idx) => ({
          ...s,
          position: idx,
        }));

        setStages(reorderedStages);
        await handleSaveStages(reorderedStages);
      }
      return;
    }

    // 2. Task reordering or moving
    if (activeTask) {
      const activeIdx = tasks.findIndex((t) => t.id === activeId);
      const activeTaskItem = tasks[activeIdx];

      let targetStageId = overId;
      const isOverTask = tasks.some((t) => t.id === overId);

      if (isOverTask) {
        const overTask = tasks.find((t) => t.id === overId);
        targetStageId = overTask!.stage_id;
      }

      // Re-order active stage tasks
      let updatedTasks = [...tasks];

      if (activeTaskItem.stage_id !== targetStageId) {
        // Move task between columns
        updatedTasks[activeIdx] = { ...activeTaskItem, stage_id: targetStageId };
      }

      // Recalculate positions for all stages affected
      const finalTasks = updatedTasks.map((t) => t); // Clone

      // Re-index positions within each column
      stages.forEach((stage) => {
        const stageTasks = finalTasks
          .filter((t) => t.stage_id === stage.id)
          .sort((a, b) => a.position - b.position);

        // If the task was moved or reordered, make sure it matches the drop target position
        if (stage.id === targetStageId) {
          const activeIndexInStage = stageTasks.findIndex((t) => t.id === activeId);
          if (activeIndexInStage !== -1) {
            const overIndexInStage = stageTasks.findIndex((t) => t.id === overId);
            if (overIndexInStage !== -1 && activeIndexInStage !== overIndexInStage) {
              const movedTasks = arrayMove(stageTasks, activeIndexInStage, overIndexInStage);
              movedTasks.forEach((t, idx) => {
                t.position = idx;
              });
            } else {
              stageTasks.forEach((t, idx) => {
                t.position = idx;
              });
            }
          } else {
            stageTasks.forEach((t, idx) => {
              t.position = idx;
            });
          }
        } else {
          stageTasks.forEach((t, idx) => {
            t.position = idx;
          });
        }
      });

      setTasks(finalTasks);

      // Save to database
      try {
        const res = await fetch(`/api/kanban/${projectId}/tasks`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: finalTasks }),
        });
        if (!res.ok) throw new Error("Failed to save tasks configuration");
        await fetchData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Board Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Project Kanban Board</h2>
        </div>
        <button
          onClick={() => setShowStageSettings(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-opacity hover:opacity-90 shadow-sm"
        >
          <Settings size={16} />
          Configure Columns
        </button>
      </div>

      {/* Columns Container */}
      <div className="flex gap-6 overflow-x-auto pb-4 pt-1 items-start min-h-[calc(100vh-250px)]">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={stages.map((s) => s.id)}
            strategy={horizontalListSortingStrategy}
          >
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                tasks={tasks
                  .filter((t) => t.stage_id === stage.id)
                  .sort((a, b) => a.position - b.position)}
                onAddTask={(stageId) => {
                  setTaskFormStageId(stageId);
                  setTaskFormTask(null);
                  setTaskTitle("");
                  setTaskDesc("");
                  setShowTaskForm(true);
                }}
                onEditTask={(task) => {
                  setTaskFormTask(task);
                  setTaskTitle(task.title);
                  setTaskDesc(task.description);
                  setShowTaskForm(true);
                }}
                onDeleteTask={handleDeleteTask}
              />
            ))}
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: "0.5",
                  },
                },
              }),
            }}
          >
            {activeColumn && (
              <KanbanColumn
                stage={activeColumn}
                tasks={tasks.filter((t) => t.stage_id === activeColumn.id)}
                onAddTask={() => {}}
                onEditTask={() => {}}
                onDeleteTask={() => {}}
              />
            )}
            {activeTask && (
              <KanbanTaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Configure Columns Settings Modal */}
      {showStageSettings && (
        <StageSettingsModal
          stages={stages}
          onClose={() => setShowStageSettings(false)}
          onSave={handleSaveStages}
        />
      )}

      {/* Task Creation / Edit Modal */}
      {showTaskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleSaveTask}
            className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--card-foreground)]">
                {taskFormTask ? "Edit Task" : "Create New Task"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowTaskForm(false);
                  setTaskFormTask(null);
                }}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--muted-foreground)]">Title</label>
              <input
                type="text"
                required
                placeholder="Task title..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--muted-foreground)]">Description</label>
              <textarea
                placeholder="Details of the task..."
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowTaskForm(false);
                  setTaskFormTask(null);
                }}
                className="secondary-button rounded-lg px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {taskFormTask ? "Save Task" : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Simple X icon replacement since we need it in modals
function X(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
