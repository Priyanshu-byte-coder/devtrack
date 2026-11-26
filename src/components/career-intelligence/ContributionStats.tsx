"use client";

import React, { useEffect, useState } from "react";
import {
  GitPullRequest,
  FolderGit2,
  Code2,
  Plus,
  Minus,
  Eye,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ContributionScores, DomainScore } from "@/types/cv-types";

interface ContributionStatsProps {
  scores: ContributionScores;
  domains: DomainScore[];
}

function Counter({
  value,
  locale,
  className,
}: {
  value: number;
  locale: string;
  className?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) {
      setCount(0);
      return;
    }
    const duration = 1000; // 1 second
    const increment = Math.ceil(end / 30);
    const stepTime = Math.abs(Math.floor(duration / 30));

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className={className}>
      {new Intl.NumberFormat(locale).format(count)}
    </span>
  );
}

export default function ContributionStats({
  scores,
  domains: _domains,
}: ContributionStatsProps) {
  const t = useTranslations("careerIntelligence");
  const locale = useLocale();

  // Count total technologies
  const totalTech = scores.topLanguages.length;

  const stats = [
    {
      label: t("stats.prsMerged"),
      value: scores.totalPRsMerged,
      icon: GitPullRequest,
      colorClass: "text-purple-500",
      bgBorderClass: "hover:border-purple-500/30",
    },
    {
      label: t("stats.repositories"),
      value: scores.totalReposContributed,
      icon: FolderGit2,
      colorClass: "text-blue-500",
      bgBorderClass: "hover:border-blue-500/30",
    },
    {
      label: t("stats.languages"),
      value: totalTech,
      icon: Code2,
      colorClass: "text-amber-500",
      bgBorderClass: "hover:border-amber-500/30",
    },
    {
      label: t("stats.linesAdded"),
      value: scores.totalAdditions,
      icon: Plus,
      colorClass: "text-emerald-500",
      bgBorderClass: "hover:border-emerald-500/30",
    },
    {
      label: t("stats.linesRemoved"),
      value: scores.totalDeletions,
      icon: Minus,
      colorClass: "text-rose-500",
      bgBorderClass: "hover:border-rose-500/30",
    },
    {
      label: t("stats.reviews"),
      value: scores.totalReviews,
      icon: Eye,
      colorClass: "text-indigo-500",
      bgBorderClass: "hover:border-indigo-500/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="px-frame bg-[var(--card)] px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
              <Icon
                className={cn("h-3.5 w-3.5", stat.colorClass)}
                aria-hidden="true"
              />
              {stat.label}
            </p>
            <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--foreground)]">
              <Counter value={stat.value} locale={locale} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
