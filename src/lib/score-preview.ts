/** What GET /api/score-preview returns for a GitHub login. */
export interface ScorePreview {
  login: string;
  name: string | null;
  member: boolean;
  tier: string | null;
  level: number;
  rank: number | null;
  rankEstimated: boolean;
  players: number;
  streak: number | null;
  contributions: number | null;
  prs: number | null;
  topLanguage: string | null;
}
