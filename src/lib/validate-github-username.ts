const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isValidGitHubUsername(username: string): boolean {
  return GITHUB_USERNAME_RE.test(username);
}

export function normalizeGitHubUsername(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return isValidGitHubUsername(trimmed) ? trimmed : null;
}
