"use client";

import React from "react";
import { Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { AchievementDef } from "@/lib/achievements-config";

interface AchievementNotificationProps {
  achievement: AchievementDef;
  t: string | number; // Toast ID to allow dismissing
}

export default function AchievementNotification({ achievement, t }: AchievementNotificationProps) {
  return (
    <div className="flex w-full max-w-sm overflow-hidden rounded-lg bg-[var(--card)] shadow-lg border border-[var(--border)] animate-in slide-in-from-right-8 duration-300">
      <div className="flex w-16 items-center justify-center bg-gradient-to-br from-[#FFD700]/80 to-[#DAA520]/80">
        <Trophy className="h-8 w-8 text-white animate-bounce" />
      </div>
      
      <div className="flex-1 px-4 py-3">
        <div className="mx-auto flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#DAA520] uppercase tracking-wider mb-0.5">
              Achievement Unlocked!
            </span>
            <p className="text-sm font-bold text-[var(--foreground)]">
              {achievement.title}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {achievement.description}
            </p>
          </div>
          
          <button
            onClick={() => toast.dismiss(t)}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1 rounded-md"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export const showAchievementNotification = (achievement: AchievementDef) => {
  toast.custom((t) => (
    <AchievementNotification achievement={achievement} t={t} />
  ), {
    duration: 5000,
    position: "bottom-right",
  });
};
