"use client";

import React from "react";
import { Lock } from "lucide-react";
import { AchievementDef } from "@/lib/achievements-config";
import AchievementProgress from "./AchievementProgress";

interface LockedAchievementCardProps {
  achievement: AchievementDef;
  currentValue: number;
}

export default function LockedAchievementCard({ achievement, currentValue }: LockedAchievementCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-5 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-[var(--card-muted)] text-[var(--muted-foreground)]">
          <Lock size={24} />
        </div>
        
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-bold text-sm sm:text-base text-[var(--muted-foreground)]">{achievement.title}</h4>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)]">
              {achievement.tier}
            </span>
          </div>
          
          <p className="text-xs text-[var(--muted-foreground)] mb-2">
            {achievement.description}
          </p>
          
          <AchievementProgress 
            current={currentValue} 
            total={achievement.requirement} 
            label={achievement.category.replace("_", " ")} 
          />
        </div>
      </div>
    </div>
  );
}
