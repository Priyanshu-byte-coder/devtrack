/**
 * Trims whitespace and converts a username to lowercase.
 * @param username - The raw username string.
 * @returns The cleaned username.
 */
export function cleanUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Formats a repository name by trimming, replacing spaces with hyphens, and converting to lowercase.
 * @param name - The raw repository name.
 * @returns The formatted repository name.
 */
export function formatRepositoryName(name: string): string {
  return name.trim().replace(/\s+/g, "-").toLowerCase();
}
