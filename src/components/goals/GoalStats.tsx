"use client";

import React from "react";
import { Target, CheckCircle2, ListTodo } from "lucide-react";
import { Goal } from "./GoalsSection";

interface GoalStatsProps {
  goals: Goal[];
}

export default function GoalStats({ goals }: GoalStatsProps) {
  const total = goals.length;
  const completed = goals.filter(g => g.current >= g.target).length;
  const active = total - completed;

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col items-center justify-center gap-1 shadow-sm">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <ListTodo size={16} />
          <span className="text-xs font-medium uppercase tracking-wider">Total</span>
        </div>
        <span className="text-2xl font-bold text-[var(--foreground)]">{total}</span>
      </div>
      
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col items-center justify-center gap-1 shadow-sm">
        <div className="flex items-center gap-2 text-blue-500">
          <Target size={16} />
          <span className="text-xs font-medium uppercase tracking-wider">Active</span>
        </div>
        <span className="text-2xl font-bold text-[var(--foreground)]">{active}</span>
      </div>
      
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col items-center justify-center gap-1 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-500">
          <CheckCircle2 size={16} />
          <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
        </div>
        <span className="text-2xl font-bold text-[var(--foreground)]">{completed}</span>
      </div>
    </div>
  );
}
