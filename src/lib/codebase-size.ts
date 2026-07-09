/**
 * Pure utility that classifies a repository's codebase size based on total
 * language bytes returned by the GitHub REST API (`/repos/:owner/:repo/languages`).
 *
 * Thresholds (per issue #2601):
 *   < 50 KB  (51,200 bytes)  → "Small"
 *   50–500 KB (512,000 bytes) → "Medium"
 *   > 500 KB                  → "Large"
 */

export type CodebaseSize = "Small" | "Medium" | "Large";

const SMALL_THRESHOLD = 51_200; // 50 KB
const LARGE_THRESHOLD = 512_000; // 500 KB

/**
 * Classifies a codebase by its total byte count.
 */
export function getCodebaseSize(totalBytes: number): CodebaseSize {
  if (totalBytes < SMALL_THRESHOLD) return "Small";
  if (totalBytes <= LARGE_THRESHOLD) return "Medium";
  return "Large";
}

interface LanguageEntry {
  bytes: number;
}

/**
 * Convenience wrapper: sums `bytes` from a languages array and returns the
 * codebase size classification.  Returns `null` when there is no language data.
 */
export function getCodebaseSizeFromLanguages(
  languages: LanguageEntry[] | undefined
): CodebaseSize | null {
  if (!languages || languages.length === 0) return null;

  const totalBytes = languages.reduce((sum, lang) => sum + lang.bytes, 0);
  if (totalBytes <= 0) return null;

  return getCodebaseSize(totalBytes);
}
