import { normalizeGitHubUsername } from "./validate-github-username";

export function normalizeRoomGithubUsername(
  value: string | null | undefined
): string | null {
  return normalizeGitHubUsername(value);
}

export function githubUsernamesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
