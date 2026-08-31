/**
 * GitHub Organization utilities.
 *
 * Fetches the organizations the authenticated user belongs to via the
 * GitHub REST API.  Requires the `read:org` OAuth scope for private
 * membership visibility; without it the endpoint silently returns only
 * public memberships (no error), so callers always get a best-effort list.
 */

import { GITHUB_API } from "@/lib/github";

export interface GitHubOrg {
  id: number;
  login: string;
  avatar_url: string;
  description: string | null;
}

/**
 * Fetch the authenticated user's organization memberships.
 *
 * Returns an empty array rather than throwing on network or permission
 * failures so callers can degrade gracefully when the `read:org` scope
 * has not been granted.
 */
export async function fetchUserOrgs(token: string): Promise<GitHubOrg[]> {
  try {
    const res = await fetch(`${GITHUB_API}/user/orgs?per_page=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      // 403 / 404 typically means missing read:org scope or the token is
      // revoked.  Return an empty list rather than propagating the error.
      return [];
    }

    return (await res.json()) as GitHubOrg[];
  } catch {
    return [];
  }
}

/**
 * Build the org-filter segment for a GitHub commit search query.
 *
 * Returns an empty string when orgLogin is falsy so callers can safely
 * concatenate it without a conditional:
 *   `author:${login}${orgSearchSegment(orgLogin)} author-date:>=...`
 */
export function orgSearchSegment(orgLogin: string | null | undefined): string {
  return orgLogin ? ` org:${orgLogin}` : "";
}
