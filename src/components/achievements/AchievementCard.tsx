"use client";

import React from "react";
import { GitCommit, GitPullRequest, Flame, BookMarked, Trophy } from "lucide-react";
import { AchievementDef } from "@/lib/achievements-config";

interface AchievementCardProps {
  achievement: AchievementDef;
  unlockedAt?: string; // ISO date string
}

const TIER_COLORS = {
  Bronze: "from-[#CD7F32]/20 to-[#8C5822]/10 border-[#CD7F32]/40 text-[#CD7F32]",
  Silver: "from-[#C0C0C0]/20 to-[#808080]/10 border-[#C0C0C0]/40 text-[#C0C0C0]",
  Gold: "from-[#FFD700]/20 to-[#DAA520]/10 border-[#FFD700]/40 text-[#FFD700]",
  Platinum: "from-[#E5E4E2]/20 to-[#B0C4DE]/10 border-[#E5E4E2]/40 text-[#E5E4E2]",
};

export default function AchievementCard({ achievement, unlockedAt }: AchievementCardProps) {
  const IconComponent = () => {
    switch (achievement.iconName) {
      case "GitCommit": return <GitCommit size={24} />;
      case "GitPullRequest": return <GitPullRequest size={24} />;
      case "Flame": return <Flame size={24} />;
      case "BookMarked": return <BookMarked size={24} />;
      default: return <Trophy size={24} />;
    }
  };

  const formattedDate = unlockedAt ? new Date(unlockedAt).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric"
  }) : "Recently";

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${TIER_COLORS[achievement.tier]} p-5 shadow-sm transition-transform hover:scale-[1.02] duration-300`}>
      <div className="absolute top-0 right-0 -mt-2 -mr-2 opacity-10">
        <IconComponent />
      </div>
      
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl bg-black/20 ${TIER_COLORS[achievement.tier].split(" ").pop()}`}>
          <IconComponent />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-bold text-sm sm:text-base text-[var(--foreground)]">{achievement.title}</h4>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border bg-black/20 ${TIER_COLORS[achievement.tier].split(" ").pop()}`}>
              {achievement.tier}
            </span>
          </div>
          
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            {achievement.description}
          </p>
          
          <div className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1">
            <span>Unlocked</span>
            <span className="font-medium">{formattedDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
