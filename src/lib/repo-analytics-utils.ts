// A valid GitHub repository identifier is exactly "owner/repo".
const REPO_IDENTIFIER_RE =
  /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)\/([a-zA-Z0-9._-]{1,100})$/;

export interface ParsedRepo {
  owner: string;
  repo: string;
}

/**
 * Validates and parses a raw "owner/repo" string.
 * Returns the split components on success, or null if the value is invalid.
 */
export function parseRepoParam(raw: string): ParsedRepo | null {
  const trimmed = raw.trim();
  const match = REPO_IDENTIFIER_RE.exec(trimmed);
  if (!match) return null;

  const [, owner, repo] = match;
  if (repo === "." || repo === "..") return null;

  return { owner, repo };
}
