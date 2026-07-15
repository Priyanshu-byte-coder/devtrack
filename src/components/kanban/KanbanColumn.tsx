"use client";

import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Settings2 } from "lucide-react";
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

interface Dependency {
  id: string;
  project_id: string;
  blocked_task_id: string;
  blocking_task_id: string;
}

interface KanbanColumnProps {
  stage: Stage;
  tasks: Task[];
  dependencies: Dependency[];
  onAddTask: (stageId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onManageDependencies: (task: Task) => void;
}

export default function KanbanColumn({
  stage,
  tasks,
  dependencies,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onManageDependencies,
}: KanbanColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id, data: { type: "column", stage } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col flex-shrink-0 w-80 h-[calc(100vh-280px)] rounded-xl border border-[var(--border)] bg-[var(--control)] overflow-hidden shadow-sm"
    >
      {/* Column Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card)] cursor-grab active:cursor-grabbing select-none"
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-3.5 h-3.5 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-sm font-bold text-[var(--foreground)] truncate max-w-[160px]">
            {stage.name}
          </h3>
          <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Task List container */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[150px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => {
            const blockersCount = dependencies.filter((d) => d.blocked_task_id === task.id).length;
            const blockingCount = dependencies.filter((d) => d.blocking_task_id === task.id).length;

            return (
              <KanbanTaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                blockersCount={blockersCount}
                blockingCount={blockingCount}
                onManageDependencies={onManageDependencies}
              />
            );
          })}
        </SortableContext>
      </div>

      {/* Add Task footer */}
      <button
        onClick={() => onAddTask(stage.id)}
        className="flex items-center justify-center gap-2 border-t border-[var(--border)] bg-[var(--card)] py-3 text-xs font-semibold text-[var(--accent)] transition-all hover:bg-[var(--accent-soft)]"
      >
        <Plus size={14} />
        Add Task
      </button>
    </div>
  );
}
