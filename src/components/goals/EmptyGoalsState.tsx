"use client";

import React from "react";
import { Target } from "lucide-react";

interface EmptyGoalsStateProps {
  onCreateClick: () => void;
}

export default function EmptyGoalsState({ onCreateClick }: EmptyGoalsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]">
      <div className="bg-[var(--accent)]/10 p-4 rounded-full mb-4">
        <Target size={32} className="text-[var(--accent)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No Goals Set Yet</h3>
      <p className="text-sm text-[var(--muted-foreground)] max-w-md mb-6">
        Setting goals is a great way to stay motivated and track your coding consistency. Set a goal for weekly commits, PRs, or a coding streak!
      </p>
      <button
        onClick={onCreateClick}
        className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition hover:opacity-90 shadow-sm"
      >
        Create Your First Goal
      </button>
    </div>
  );
}
