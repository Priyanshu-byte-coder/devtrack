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

export interface GoalMentorPromptParams {
  totalCommits: number;
  activeDays: number;
  longestStreak: number;
  prsMerged: number;
  topRepoName: string;
  repoCount: number;
  languages: string[];
}

export function goalMentorPrompt(params: GoalMentorPromptParams): string {
  return `You are a senior engineering mentor suggesting realistic, yet challenging coding goals for a developer based on their recent GitHub activity.

Here is their data from the past 30 days:
- Active coding days: ${params.activeDays} days
- Total commits: ${params.totalCommits}
- Longest streak: ${params.longestStreak} days
- PRs merged: ${params.prsMerged}
- Top repository: ${params.topRepoName} (active across ${params.repoCount} repositories)
- Programming languages used: ${params.languages.join(", ")}

Suggest exactly 3 customized weekly or monthly coding goals.
For each suggestion, provide:
1. title: A short description of the goal (e.g. "Increase commits to ${params.topRepoName}", "Commit consistently to maintain streak")
2. target: A realistic number (integer) to aim for.
3. unit: The target unit. Must be exactly one of: "commits", "prs", "hours", "streak", or "language" (Lines of Code).
4. recurrence: Must be "weekly" or "monthly".
5. reasoning: A short, encouraging one-sentence explanation of why this goal is suggested based on the data.

Respond with ONLY valid JSON, matching exactly this shape:
{
  "suggestions": [
    {
      "title": "goal title",
      "target": 10,
      "unit": "commits",
      "recurrence": "weekly",
      "reasoning": "You committed 8 times to ${params.topRepoName} last week. Aim for 10 to keep the momentum!"
    }
  ]
}`;
}