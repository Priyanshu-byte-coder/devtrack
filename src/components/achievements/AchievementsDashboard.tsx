"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import BadgeGrid from "./BadgeGrid";
import AchievementCard from "./AchievementCard";
import LockedAchievementCard from "./LockedAchievementCard";
import { showAchievementNotification } from "./AchievementNotification";
import { AchievementDef, AchievementCategory, ACHIEVEMENTS } from "@/lib/achievements-config";

interface AchievementsResponse {
  metrics: Record<AchievementCategory, number>;
  unlockedIds: string[];
  newUnlocks: string[];
  achievements: AchievementDef[];
}

export default function AchievementsDashboard() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<AchievementsResponse | null>(null);

  const fetchAchievements = async (isSync = false) => {
    if (isSync) setSyncing(true);
    try {
      const res = await fetch("/api/achievements/evaluate", { method: "POST" });
      if (!res.ok) throw new Error("Failed to load achievements");
      const result: AchievementsResponse = await res.json();
      
      setData(result);
      
      if (result.newUnlocks?.length > 0) {
        result.newUnlocks.forEach(id => {
          const achievement = ACHIEVEMENTS.find(a => a.id === id);
          if (achievement) showAchievementNotification(achievement);
        });
      }
      
      if (isSync) toast.success("Achievements synced successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load achievements.");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchAchievements();
  }, []);

  if (loading && !data) {
    return (
      <div className="bg-[var(--card)] rounded-xl p-6 shadow-sm border border-[var(--border)] min-h-[300px] flex items-center justify-center animate-pulse">
        <div className="flex flex-col items-center gap-4 text-[var(--muted-foreground)]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <div className="text-sm">Evaluating achievements...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[var(--card)] rounded-xl p-6 shadow-sm border border-[var(--border)] text-center">
        <p className="text-[var(--muted-foreground)] mb-4">Unable to load achievements.</p>
        <button 
          onClick={() => fetchAchievements(true)}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Group achievements by category
  const grouped = ACHIEVEMENTS.reduce((acc, ach) => {
    if (!acc[ach.category]) acc[ach.category] = [];
    acc[ach.category].push(ach);
    return acc;
  }, {} as Record<AchievementCategory, AchievementDef[]>);

  const totalUnlocked = data.unlockedIds.length;
  const totalAchievements = ACHIEVEMENTS.length;
  const completionPercentage = Math.round((totalUnlocked / totalAchievements) * 100);

  return (
    <div className="space-y-6">
      {/* Header & Overall Progress */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Achievements & Milestones</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Track your open-source journey and unlock badges.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold">{totalUnlocked} / {totalAchievements} Unlocked</span>
            <div className="w-32 h-2 bg-[var(--card-muted)] rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#FFD700] to-[#DAA520] transition-all duration-1000"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
          
          <button
            onClick={() => fetchAchievements(true)}
            disabled={syncing}
            className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--control)] rounded-md transition-colors disabled:opacity-50"
            title="Sync with GitHub"
          >
            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Render categories */}
      {Object.entries(grouped).map(([category, achievements]) => (
        <BadgeGrid key={category} title={category}>
          {achievements.map((ach) => {
            const isUnlocked = data.unlockedIds.includes(ach.id);
            const currentVal = data.metrics[ach.category as AchievementCategory] || 0;
            
            return isUnlocked ? (
              <AchievementCard 
                key={ach.id} 
                achievement={ach} 
                // Unlocked date would typically come from DB if passed through, 
                // but we omitted it in API response mapping for simplicity; 
                // can enhance later.
              />
            ) : (
              <LockedAchievementCard 
                key={ach.id} 
                achievement={ach} 
                currentValue={currentVal} 
              />
            );
          })}
        </BadgeGrid>
      ))}
    </div>
  );
}
