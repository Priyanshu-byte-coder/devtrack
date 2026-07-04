"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink, Award, Sparkles, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContributionClassification, EngineeringDomain } from "@/types/cv-types";

interface ContributionAnalysisPanelProps {
  analysis: ContributionClassification;
}

const DOMAIN_STYLES: Record<
  EngineeringDomain,
  { bg: string; text: string; bar: string; border: string }
> = {
  Frontend: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    bar: "bg-gradient-to-r from-blue-600 to-blue-400",
    border: "border-blue-500/20",
  },
  Backend: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    bar: "bg-gradient-to-r from-emerald-600 to-emerald-400",
    border: "border-emerald-500/20",
  },
  AI_ML: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    bar: "bg-gradient-to-r from-purple-600 to-purple-400",
    border: "border-purple-500/20",
  },
  DevOps: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    bar: "bg-gradient-to-r from-orange-600 to-orange-400",
    border: "border-orange-500/20",
  },
  DataScience: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    bar: "bg-gradient-to-r from-yellow-600 to-yellow-400",
    border: "border-yellow-500/20",
  },
  Security: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    bar: "bg-gradient-to-r from-rose-600 to-rose-400",
    border: "border-rose-500/20",
  },
  Mobile: {
    bg: "bg-pink-500/10",
    text: "text-pink-400",
    bar: "bg-gradient-to-r from-pink-600 to-pink-400",
    border: "border-pink-500/20",
  },
  Systems: {
    bg: "bg-teal-500/10",
    text: "text-teal-400",
    bar: "bg-gradient-to-r from-teal-600 to-teal-400",
    border: "border-teal-500/20",
  },
  FullStack: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    bar: "bg-gradient-to-r from-indigo-600 to-indigo-400",
    border: "border-indigo-500/20",
  },
};

export default function ContributionAnalysisPanel({ analysis }: ContributionAnalysisPanelProps) {
  const { techStack, domains, repositoryAnalyses } = analysis;

  const renderConfidenceBadge = (confidence: "high" | "medium" | "low") => {
    const styles = {
      high: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
      medium: "border-blue-500/20 bg-blue-500/10 text-blue-400",
      low: "border-gray-500/20 bg-gray-500/10 text-gray-400",
    };
    return (
      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider", styles[confidence])}>
        {confidence}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engineering Domains */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
            <Award className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="text-lg font-bold text-[var(--foreground)]">Engineering Domains</h3>
          </div>

          <div className="space-y-4">
            {domains.map((ds) => {
              const style = DOMAIN_STYLES[ds.domain] || DOMAIN_STYLES.FullStack;
              return (
                <div key={ds.domain} className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-[var(--foreground)]">{ds.domain}</span>
                    <span className={style.text}>{ds.score}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-[var(--card-muted)] rounded-full overflow-hidden border border-[var(--border)]/50">
                    <div
                      className={cn("h-full rounded-full transition-all duration-1000", style.bar)}
                      style={{ width: `${ds.score}%` }}
                    />
                  </div>
                  {ds.evidence.length > 0 && (
                    <p className="text-[10px] text-[var(--muted-foreground)] italic">
                      Evidence: {ds.evidence.slice(0, 2).join(" • ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Technology Stack */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="text-lg font-bold text-[var(--foreground)]">Technology Stack</h3>
          </div>

          <div className="space-y-5">
            {/* Languages */}
            {techStack.languages.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Languages
                </h4>
                <div className="flex flex-wrap gap-2">
                  {techStack.languages.slice(0, 10).map((tech) => (
                    <Badge
                      key={tech.name}
                      variant="outline"
                      className="flex items-center gap-1.5 border-[var(--border)] bg-[var(--card-muted)] hover:bg-[var(--border)]/10 text-xs px-2.5 py-1 text-[var(--foreground)]"
                    >
                      {tech.name}
                      {renderConfidenceBadge(tech.confidence)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Frameworks */}
            {techStack.frameworks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Frameworks & Libraries
                </h4>
                <div className="flex flex-wrap gap-2">
                  {techStack.frameworks.slice(0, 10).map((tech) => (
                    <Badge
                      key={tech.name}
                      variant="outline"
                      className="flex items-center gap-1.5 border-[var(--border)] bg-[var(--card-muted)] hover:bg-[var(--border)]/10 text-xs px-2.5 py-1 text-[var(--foreground)]"
                    >
                      {tech.name}
                      {renderConfidenceBadge(tech.confidence)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tools */}
            {techStack.tools.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Tools & Platforms
                </h4>
                <div className="flex flex-wrap gap-2">
                  {techStack.tools.slice(0, 10).map((tech) => (
                    <Badge
                      key={tech.name}
                      variant="outline"
                      className="flex items-center gap-1.5 border-[var(--border)] bg-[var(--card-muted)] hover:bg-[var(--border)]/10 text-xs px-2.5 py-1 text-[var(--foreground)]"
                    >
                      {tech.name}
                      {renderConfidenceBadge(tech.confidence)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Repositories */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
          <FolderKanban className="h-5 w-5 text-[var(--accent)]" />
          <h3 className="text-lg font-bold text-[var(--foreground)]">Top Repositories & Contributions</h3>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {repositoryAnalyses.slice(0, 6).map((repo) => (
            <div key={repo.nameWithOwner} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-bold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                  >
                    {repo.name}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 border border-[var(--border)] uppercase font-semibold">
                    {repo.complexity} Complexity
                  </Badge>
                  {repo.prsMerged > 0 && (
                    <Badge variant="success" className="text-[10px] px-2 py-0.5 font-semibold">
                      {repo.prsMerged} PRs Merged
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
                  {repo.description ?? "No description available."}
                </p>

                {/* Detected domains */}
                <div className="flex flex-wrap gap-1">
                  {repo.detectedDomains.map((dom) => {
                    const style = DOMAIN_STYLES[dom] || DOMAIN_STYLES.FullStack;
                    return (
                      <span key={dom} className={cn("text-[9px] px-2 py-0.5 rounded border font-semibold", style.bg, style.text, style.border)}>
                        {dom}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Technologies & Metrics */}
              <div className="flex flex-wrap gap-1.5 md:justify-end max-w-xs">
                {repo.languages.slice(0, 3).map((lang) => (
                  <span key={lang} className="text-[10px] font-medium text-[var(--muted-foreground)] px-2 py-0.5 rounded bg-[var(--card-muted)] border border-[var(--border)]">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
