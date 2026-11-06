// A valid GitHub repository identifier is exactly "owner/repo".
const REPO_IDENTIFIER_RE =
  /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)\/([a-zA-Z0-9._-]{1,100})$/;

export interface ParsedRepo {
  owner: string;
  repo: string;
}

/**
 * Validates and parses a raw "owner/repo" string.
 * Strips a single leading slash and collapses consecutive slashes before
 * validating, so inputs like "/owner/repo" or "owner//repo" (e.g. from
 * referrer headers or query params) normalise to "owner/repo" instead of
 * silently failing to match.
 * Returns the split components on success, or null if the value is invalid.
 */
export function parseRepoParam(raw: string): ParsedRepo | null {
  const trimmed = raw.trim();
  const withoutLeadingSlash = trimmed.startsWith("/")
    ? trimmed.slice(1)
    : trimmed;
  const normalised = withoutLeadingSlash.replace(/\/{2,}/g, "/");
  const match = REPO_IDENTIFIER_RE.exec(normalised);
  if (!match) return null;
  const [, owner, repo] = match;
  if (repo === "." || repo === "..") return null;
  return { owner, repo };
}
