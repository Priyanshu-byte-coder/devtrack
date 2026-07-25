import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { getAccountToken, getAllAccounts } from "@/lib/github-accounts";
import { GITHUB_API } from "@/lib/github";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function dateDiffDays(a: string, b: string): number {
  return (
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchActiveDates(
  githubLogin: string,
  token: string
): Promise<Set<string>> {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().slice(0, 10);

  const searchRes = await fetch(
    `${GITHUB_API}/search/commits?q=author:${githubLogin}+author-date:>=${sinceStr}&per_page=100&sort=author-date&order=desc`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!searchRes.ok) {
    throw new Error("GitHub API error");
  }

  const data = (await searchRes.json()) as {
    items: Array<{ commit: { author: { date: string } } }>;
  };

  const activeDates = new Set<string>();
  for (const item of data.items) {
    activeDates.add(item.commit.author.date.slice(0, 10));
  }

  const linkHeader = searchRes.headers.get("link");
  const pagePattern = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/;
  const lastPageMatch = linkHeader?.match(pagePattern);
  if (lastPageMatch) {
    const lastPage = parseInt(lastPageMatch[1], 10);
    const pagePromises: Promise<Response>[] = [];
    for (let page = 2; page <= Math.min(lastPage, 5); page++) {
      pagePromises.push(
        fetch(
          `${GITHUB_API}/search/commits?q=author:${githubLogin}+author-date:>=${sinceStr}&per_page=100&page=${page}&sort=author-date&order=desc`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
            },
            cache: "no-store",
          }
        )
      );
    }
    const pageResults = await Promise.allSettled(pagePromises);
    for (const res of pageResults) {
      if (res.status !== "fulfilled" || !res.value.ok) continue;
      const pageData = (await res.value.json()) as {
        items: Array<{ commit: { author: { date: string } } }>;
      };
      for (const item of pageData.items) {
        activeDates.add(item.commit.author.date.slice(0, 10));
      }
    }
  }

  return activeDates;
}

function calculateStreakFromDates(
  activeDates: Set<string>,
  freezeDates: Set<string>
): {
  current: number;
  longest: number;
  lastCommitDate: string | null;
  totalActiveDays: number;
} {
  const combinedDates = new Set<string>([
    ...Array.from(activeDates),
    ...Array.from(freezeDates),
  ]);
  const commitDays = Array.from(combinedDates).sort();

  if (commitDays.length === 0) {
    return {
      current: 0,
      longest: 0,
      lastCommitDate: null,
      totalActiveDays: 0,
    };
  }

  let longestStreak = 1;
  let currentRun = 1;
  const runs: { start: string; end: string; length: number }[] = [];
  let runStart = commitDays[0];

  for (let i = 1; i < commitDays.length; i++) {
    const diff = dateDiffDays(commitDays[i - 1], commitDays[i]);
    if (diff === 1) {
      currentRun++;
      if (currentRun > longestStreak) {
        longestStreak = currentRun;
      }
    } else {
      runs.push({ start: runStart, end: commitDays[i - 1], length: currentRun });
      runStart = commitDays[i];
      currentRun = 1;
    }
  }
  runs.push({
    start: runStart,
    end: commitDays[commitDays.length - 1],
    length: currentRun,
  });

  const lastDay = commitDays[commitDays.length - 1];
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));

  const lastRun = runs[runs.length - 1];
  const currentStreak =
    lastRun.end === today || lastRun.end === yesterday ? lastRun.length : 0;

  return {
    current: currentStreak,
    longest: longestStreak,
    lastCommitDate: lastDay,
    totalActiveDays: commitDays.length,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin || !session.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = req.nextUrl.searchParams.get("accountId");
  let appUserId: string | null = null;

  if (accountId) {
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("github_id", session.githubId)
      .single();

    if (!userRow) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    appUserId = userRow.id;
  } else {
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("github_id", session.githubId)
      .single();

    if (dbUser) {
      appUserId = dbUser.id;
    }
  }

  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().slice(0, 10);

  const freezeDates = new Set<string>();
  if (appUserId) {
    const { data: freezes } = await supabaseAdmin
      .from("streak_freezes")
      .select("freeze_date")
      .eq("user_id", appUserId)
      .gte("freeze_date", sinceStr);

    if (Array.isArray(freezes)) {
      for (const row of freezes) {
        freezeDates.add(row.freeze_date);
      }
    }
  }

  if (!accountId) {
    try {
      const activeDates = await fetchActiveDates(
        session.githubLogin,
        session.accessToken
      );
      return Response.json(
        calculateStreakFromDates(activeDates, freezeDates)
      );
    } catch {
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }
  }

  if (!appUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (accountId === "combined") {
    const accounts = await getAllAccounts(
      {
        token: session.accessToken,
        githubId: session.githubId,
        githubLogin: session.githubLogin,
      },
      appUserId
    );

    const dateResults = await Promise.allSettled(
      accounts.map((account) =>
        fetchActiveDates(account.githubLogin, account.token)
      )
    );

    const unifiedDates = new Set<string>();
    for (const result of dateResults) {
      if (result.status === "fulfilled") {
        result.value.forEach((date) => unifiedDates.add(date));
      }
    }

    return Response.json(calculateStreakFromDates(unifiedDates, freezeDates));
  }

  let resolvedToken = session.accessToken;
  let resolvedLogin = session.githubLogin;

  if (accountId !== session.githubId) {
    const accountToken = await getAccountToken(appUserId, accountId);

    if (!accountToken) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    const { data: accountRow } = await supabaseAdmin
      .from("user_github_accounts")
      .select("github_login")
      .eq("user_id", appUserId)
      .eq("github_id", accountId)
      .single();

    if (!accountRow?.github_login) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    resolvedToken = accountToken;
    resolvedLogin = accountRow.github_login;
  }

  try {
    const activeDates = await fetchActiveDates(resolvedLogin, resolvedToken);
    return Response.json(calculateStreakFromDates(activeDates, freezeDates));
  } catch {
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
