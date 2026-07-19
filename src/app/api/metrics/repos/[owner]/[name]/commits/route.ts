import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { GITHUB_API } from "@/lib/github";
import { getAccountToken } from "@/lib/github-accounts";
import { resolveAppUser } from "@/lib/resolve-user";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string }> }
) {
  const resolvedParams = await params;

  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repoFullName = `${resolvedParams.owner}/${resolvedParams.name}`;
  const accountId = req.nextUrl.searchParams.get("accountId");
  
  let token = session.accessToken;
  let authorLogin = session.githubLogin;

  if (accountId && accountId !== "combined" && accountId !== session.githubId) {
    if (session.githubId) {
      const userRow = await resolveAppUser(session.githubId, session.githubLogin);
      if (userRow) {
        const accountToken = await getAccountToken(userRow.id, accountId);
        if (accountToken) {
          token = accountToken;
          const { data: accountRow } = await supabaseAdmin
            .from("user_github_accounts")
            .select("github_login")
            .eq("user_id", userRow.id)
            .eq("github_id", accountId)
            .single();
          if (accountRow?.github_login) {
            authorLogin = accountRow.github_login;
          }
        }
      }
    }
  }

  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString();

  const res = await fetch(
    `${GITHUB_API}/repos/${repoFullName}/commits?author=${authorLogin}&since=${sinceStr}&per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return Response.json({ error: "GitHub API error" }, { status: res.status });
  }

  const commits = (await res.json()) as any[];
  
  const timestamps = commits.map(c => c.commit.author.date);
  
  const heatmapData: Record<string, number> = {};
  for (const ts of timestamps) {
    const dateKey = ts.split("T")[0];
    heatmapData[dateKey] = (heatmapData[dateKey] || 0) + 1;
  }

  return Response.json({ heatmapData, timestamps });
}
