"use client";

import React, { useState, useEffect, useCallback } from "react";
import GoalCard from "./GoalCard";
import GoalForm from "./GoalForm";
import GoalModal from "./GoalModal";
import GoalStats from "./GoalStats";
import EmptyGoalsState from "./EmptyGoalsState";
import GoalHistory from "../GoalHistory";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import SectionHeader from "../SectionHeader";

export type Recurrence = "none" | "weekly" | "monthly";

export interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  recurrence: Recurrence;
  deadline: string | null;
  is_public: boolean;
  period_start: string;
  last_synced_at: string | null;
}

export default function GoalsSection() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadGoals = useCallback(async () => {
    try {
      const response = await fetch("/api/goals");
      if (!response.ok) throw new Error("Failed to load goals");
      const data = await response.json();
      setGoals(data.goals || []);
      setLastUpdated(new Date());
    } catch (err) {
      toast.error("Failed to load goals.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSync = useCallback(async (showToast = false) => {
    setSyncing(true);
    try {
      const res = await fetch("/api/goals/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      await loadGoals();
      if (showToast) toast.success("Goals synced with GitHub activity!");
    } catch (err) {
      if (showToast) toast.error("Failed to sync goals.");
    } finally {
      setSyncing(false);
    }
  }, [loadGoals]);

  useEffect(() => {
    loadGoals().then(() => {
      // Auto-sync if goals haven't been synced in the last 15 minutes
      handleSync(false);
    });
  }, [loadGoals, handleSync]);

  const handleCreateOrEdit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const url = editingGoal ? `/api/goals/${editingGoal.id}` : "/api/goals";
      const method = editingGoal ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save goal");
      }

      toast.success(editingGoal ? "Goal updated successfully!" : "Goal created successfully!");
      setIsModalOpen(false);
      setEditingGoal(null);
      await loadGoals();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    try {
      const res = await fetch(`/api/goals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete goal");
      toast.success("Goal deleted.");
      setGoals(goals.filter((g) => g.id !== id));
    } catch (err) {
      toast.error("Failed to delete goal.");
    }
  };

  const handleTogglePublic = async (id: string, is_public: boolean) => {
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public }),
      });
      if (!res.ok) throw new Error("Failed to update visibility");
      setGoals(goals.map(g => g.id === id ? { ...g, is_public } : g));
      toast.success(is_public ? "Goal is now public" : "Goal is now private");
    } catch (err) {
      toast.error("Failed to update visibility.");
    }
  };

  const handleIncrement = async (goal: Goal) => {
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: goal.current + 1 }),
      });
      if (!res.ok) throw new Error("Failed to update progress");
      setGoals(goals.map(g => g.id === goal.id ? { ...g, current: goal.current + 1 } : g));
    } catch (err) {
      toast.error("Failed to update progress.");
    }
  };

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}/goals/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Public link copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openCreateModal = () => {
    setEditingGoal(null);
    setIsModalOpen(true);
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="bg-[var(--card)] rounded-xl p-6 shadow-sm border border-[var(--border)] min-h-[300px] flex items-center justify-center animate-pulse">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <div className="text-sm text-[var(--muted-foreground)]">Loading goals...</div>
        </div>
      </div>
    );
  }

  const AUTO_SYNC_UNITS = ["commits", "prs", "repositories", "streak", "reviews", "issues_closed", "issues_opened", "open_source_prs"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Goals & Progress" />
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline-block">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => handleSync(true)}
            disabled={syncing}
            className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--control)] rounded-md transition-colors disabled:opacity-50"
            title="Sync with GitHub"
          >
            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground)] shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            <span>New Goal</span>
          </button>
        </div>
      </div>

      {goals.length > 0 && <GoalStats goals={goals} />}

      {goals.length === 0 ? (
        <EmptyGoalsState onCreateClick={openCreateModal} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onTogglePublic={handleTogglePublic}
              onCopyLink={handleCopyLink}
              copiedId={copiedId}
              isAutoSynced={AUTO_SYNC_UNITS.includes(goal.unit)}
              onIncrement={() => handleIncrement(goal)}
            />
          ))}
        </div>
      )}

      <GoalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGoal ? "Edit Goal" : "Create New Goal"}
      >
        <GoalForm
          initialData={editingGoal}
          onSubmit={handleCreateOrEdit}
          onCancel={() => setIsModalOpen(false)}
          isSubmitting={isSubmitting}
        />
      </GoalModal>

      {goals.length > 0 && <GoalHistory />}
    </div>
  );
}
