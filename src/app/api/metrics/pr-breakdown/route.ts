import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { GitHubAuthError, githubAuthErrorResponse } from "@/lib/github-fetch";
import { isMetricsCacheBypassed, metricsCacheKey, withMetricsCache } from "@/lib/metrics-cache";
import { getAccountToken } from "@/lib/github-accounts";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";
const GITHUB_API = "https://api.github.com";

interface PRItem { state: string; draft?: boolean; pull_request?: { merged_at: string | null; }; }

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.error === "TokenRevoked") return githubAuthErrorResponse();

  const accountId = req.nextUrl.searchParams.get("accountId");
  const bypass = isMetricsCacheBypassed(req);

  let token = session.accessToken;
  let userId = session.githubId ?? "unknown";

  if (accountId && accountId !== session.githubId) {
    if (!session.githubId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRow = await resolveAppUser(session.githubId, session.githubLogin);
    if (!userRow) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const accountToken = await getAccountToken(userRow.id, accountId);
    if (!accountToken) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }
    token = accountToken;
    userId = accountId;
  }

  const key = metricsCacheKey(userId, "pr-breakdown" as any);

  try {
    const data = await withMetricsCache({ bypass, key, ttlSeconds: 10 * 60 }, async () => {
      const res = await fetch(`${GITHUB_API}/search/issues?q=type:pr+author:@me&per_page=100`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 401) throw new GitHubAuthError();
        throw new Error("API Error");
      }

      const raw = (await res.json()) as { items: PRItem[] };
      let draft = 0, open = 0, merged = 0, closed = 0;

      for (const pr of raw.items) {
        if (pr.state === "open" && pr.draft) draft++;
        else if (pr.state === "open") open++;
        else if (pr.pull_request?.merged_at) merged++;
        else closed++;
      }
      return { draft, open, merged, closed };
    });
    return Response.json(data);
  } catch (e) {
    if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
