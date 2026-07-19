// Valid GitHub repository identifier: owner/repo
//
// owner: 1–39 chars, alphanumeric + hyphens, cannot start or end with a hyphen
// repo:  1–100 chars, alphanumeric + dots + hyphens + underscores
// exactly one slash between them — no extra path segments or operators
const REPO_IDENTIFIER_RE =
  /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)\/([a-zA-Z0-9._-]{1,100})$/;

export interface ActivityGoal {
  id: string;
  unit: string;
  repo: string | null;
  repository: string | null;
  repo_name: string | null;
}

/**
 * Reads the optional repository filter from a goal row and validates it.
 *
 * Returns a safe "owner/repo" string when the stored value is a valid GitHub
 * repository identifier, or null when it is absent, empty, or malformed.
 */
export function extractValidRepoFromGoal(goal: ActivityGoal): string | null {
  const raw = goal.repo ?? goal.repository ?? goal.repo_name;
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  const match = REPO_IDENTIFIER_RE.exec(trimmed);
  if (!match) return null;

  const [, owner, repoName] = match;
  if (repoName === "." || repoName === "..") return null;

  return `${owner}/${repoName}`;
}
