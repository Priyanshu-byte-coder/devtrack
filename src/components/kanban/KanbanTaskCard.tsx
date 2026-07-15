"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Edit2 } from "lucide-react";
import { useState } from "react";

interface Task {
  id: string;
  project_id: string;
  stage_id: string;
  title: string;
  description: string;
  position: number;
}

interface KanbanTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function KanbanTaskCard({ task, onEdit, onDelete }: KanbanTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const [isHovered, setIsHovered] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all ${
        isDragging
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20"
          : "hover:border-[var(--accent)] hover:shadow-md"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle area */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-x-0 top-0 h-4 cursor-grab active:cursor-grabbing"
      />

      <div className="flex items-start justify-between gap-2 mt-1">
        <h4 className="text-sm font-semibold text-[var(--card-foreground)] break-words flex-1">
          {task.title}
        </h4>
        <div
          className={`flex items-center gap-1.5 transition-opacity ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            onClick={() => onEdit(task)}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--control)] hover:text-[var(--foreground)]"
            title="Edit task"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
            title="Delete task"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="mt-2 text-xs text-[var(--muted-foreground)] line-clamp-3 break-words">
          {task.description}
        </p>
      )}
    </div>
  );
}
