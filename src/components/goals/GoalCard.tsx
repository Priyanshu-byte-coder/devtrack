"use client";

import React from "react";
import GoalProgressBar from "./GoalProgressBar";
import { Edit2, Trash2, Link, Link2, Share2, Medal } from "lucide-react";
import { Goal } from "./GoalsSection";

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onTogglePublic: (goalId: string, isPublic: boolean) => void;
  onCopyLink: (goalId: string) => void;
  copiedId: string | null;
  isAutoSynced: boolean;
  onIncrement: () => void;
}

export default function GoalCard({
  goal,
  onEdit,
  onDelete,
  onTogglePublic,
  onCopyLink,
  copiedId,
  isAutoSynced,
  onIncrement,
}: GoalCardProps) {
  const completed = goal.current >= goal.target;
  
  // Badges based on over-achievement
  const percentage = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
  let BadgeIcon = null;
  let badgeColor = "";
  let badgeLabel = "";
  
  if (percentage >= 200) {
    BadgeIcon = Medal;
    badgeColor = "text-yellow-400";
    badgeLabel = "Gold Achiever";
  } else if (percentage >= 150) {
    BadgeIcon = Medal;
    badgeColor = "text-gray-300";
    badgeLabel = "Silver Achiever";
  } else if (percentage >= 100) {
    BadgeIcon = Medal;
    badgeColor = "text-amber-600";
    badgeLabel = "Bronze Achiever";
  }

  const formatUnit = (unit: string) => {
    switch (unit) {
      case "commits": return "Commits";
      case "prs": return "Pull Requests";
      case "streak": return "Days Streak";
      case "repositories": return "Repositories";
      default: return unit;
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-[var(--card-foreground)]">{goal.title}</h3>
            {BadgeIcon && (
              <span title={badgeLabel} className={`flex items-center gap-1 text-xs font-semibold ${badgeColor} bg-[var(--control)] px-2 py-0.5 rounded-full border border-[var(--border)]`}>
                <BadgeIcon size={14} /> {badgeLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
            <span className="capitalize">{goal.recurrence !== "none" ? goal.recurrence : "One-time"}</span>
            <span>•</span>
            <span className="capitalize font-medium">{formatUnit(goal.unit)}</span>
            {isAutoSynced && (
              <>
                <span>•</span>
                <span className="text-[var(--accent)] font-medium">Auto-synced</span>
              </>
            )}
          </div>
          {goal.deadline && (
            <div className="mt-1 text-xs text-[var(--muted-foreground)]">
              Deadline: {new Date(goal.deadline).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
          {!isAutoSynced && !completed && (
            <button
              onClick={onIncrement}
              className="rounded bg-[var(--accent)] px-2 py-1 text-xs font-semibold text-[var(--accent-foreground)] hover:opacity-90"
            >
              +1
            </button>
          )}
          <button onClick={() => onEdit(goal)} className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-md hover:bg-[var(--control)] transition-colors">
            <Edit2 size={16} />
          </button>
          <button onClick={() => onDelete(goal.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <GoalProgressBar current={goal.current} target={goal.target} completed={completed} />

      <div className="flex items-center justify-between mt-4 text-sm">
        <div className="font-semibold text-[var(--foreground)]">
          {goal.current} / {goal.target} <span className="font-normal text-[var(--muted-foreground)]">{formatUnit(goal.unit)}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] transition-colors">
            <input
              type="checkbox"
              checked={goal.is_public}
              onChange={(e) => onTogglePublic(goal.id, e.target.checked)}
              className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            Public
          </label>
          
          {goal.is_public && (
            <button
              onClick={() => onCopyLink(goal.id)}
              className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              {copiedId === goal.id ? <CheckCircle size={14} className="text-emerald-500" /> : <Link2 size={14} />}
              {copiedId === goal.id ? "Copied" : "Copy Link"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
