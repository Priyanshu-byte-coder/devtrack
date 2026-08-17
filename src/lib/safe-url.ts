/**
 * Client-safe URL scheme allowlist for values rendered into an `href`.
 *
 * Distinct from `ssrf-protection.ts`, which resolves DNS and is server-only.
 * This runs in the browser and answers one narrower question: is it safe to put
 * this string in an anchor a user can click?
 *
 * The risk is `javascript:` (and `data:`, `vbscript:`) URIs. Every URL DevTrack
 * renders comes from the GitHub API today, so nothing here is known to be
 * attacker-controlled — but a link is one API response away from being so, and
 * the check costs nothing.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Returns the URL when its scheme is safe to render, otherwise `undefined`.
 *
 * Passing `undefined` to an `href` omits the attribute entirely, so the element
 * renders as plain text rather than a link that goes nowhere.
 *
 * Relative and protocol-relative URLs resolve against the current page and are
 * allowed; they cannot carry a scheme of their own.
 */
export function safeExternalHref(
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined;

  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Relative ("/repo", "./x") and protocol-relative ("//host/x") URLs have no
  // scheme to smuggle, so they need no allowlist check.
  if (trimmed.startsWith("/")) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Not an absolute URL and not relative — refuse rather than guess.
    return undefined;
  }

  return ALLOWED_PROTOCOLS.has(parsed.protocol) ? trimmed : undefined;
}
