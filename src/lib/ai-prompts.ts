export interface WeeklyProductivityPromptParams {
  activeDays: number;
  currentStreak: number;
  totalCommits: number;
  prsMerged: number;
  prsOpen: number;
  avgMergeTimeDays: number;
  topRepoName: string;
  trendLabel: string;
}

export function weeklyProductivityPrompt(params: WeeklyProductivityPromptParams): string {
  return `You are a senior engineering mentor reviewing a developer's GitHub activity from the past week.

Here is their data:
- Active coding days: ${params.activeDays}
- Current streak: ${params.currentStreak} days
- Total commits (90d): ${params.totalCommits}
- PRs merged: ${params.prsMerged}, open: ${params.prsOpen}
- Avg PR merge time: ${params.avgMergeTimeDays.toFixed(1)} days
- Top repository: ${params.topRepoName}
- Activity trend: ${params.trendLabel} vs prior period

Write a warm, concise 3-sentence weekly summary. Start with a highlight, add one observation, end with one actionable tip. Address the developer as "you". No bullet points.`;
}

export interface PersonalityReportPromptParams {
  workingStyle: string;
  commitPattern: string;
  collaborationStyle: string;
  perfectionismScore: number;
  nightCommitPct: number;
  morningCommitPct: number;
  totalCommits: number;
  activeDays: number;
  longestStreak: number;
  prsMerged: number;
  avgMergeTimeDays: number;
  topRepoName: string;
  repoCount: number;
}

/**
 * Builds the prompt for the AI Code Personality Report. The model is asked
 * to return strict JSON so the API route can parse it directly into the
 * PersonalityReport shape without additional text wrangling.
 */
export function personalityReportPrompt(params: PersonalityReportPromptParams): string {
  return `You are a witty developer-culture analyst generating a fun, shareable "Code Personality Report" for a software engineer based on their real GitHub activity.

Their computed traits:
- Working style: ${params.workingStyle} (${params.nightCommitPct}% of commits after 9pm, ${params.morningCommitPct}% before 9am)
- Commit pattern: ${params.commitPattern}
- Collaboration style: ${params.collaborationStyle}
- Perfectionism score: ${params.perfectionismScore}/100 (based on PR review thoroughness and commit frequency)
- Total commits (90d): ${params.totalCommits}, active days: ${params.activeDays}, longest streak: ${params.longestStreak}
- PRs merged: ${params.prsMerged}, avg merge time: ${params.avgMergeTimeDays.toFixed(1)} days
- Top repository: ${params.topRepoName} (active across ${params.repoCount} repos)

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{
  "archetype": "a punchy 2-4 word developer archetype name, e.g. 'The Midnight Architect'",
  "tagline": "one short punchy sentence capturing their coding identity",
  "description": "2-3 sentences, second person ('you'), warm and specific to the data above, no generic filler",
  "strengths": ["short strength phrase", "short strength phrase", "short strength phrase"],
  "funFact": "one playful one-line observation derived from the data"
}`;
}