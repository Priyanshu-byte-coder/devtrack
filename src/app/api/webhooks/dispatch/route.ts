import { NextResponse } from "next/server";
import { getSessionWithToken } from "@/lib/get-session-token";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { GITHUB_API } from "@/lib/github";
import { dispatchToAllWebhooks } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

interface MetricsData {
  commits: number;
  prsOpened: number;
  prsMerged: number;
  activeDays: number;
}

async function getUserMetrics(
  githubLogin: string,
  token: string,
  days: number
): Promise<MetricsData> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const commitsRes = await fetch(
    `${GITHUB_API}/search/commits?q=author:${githubLogin}+author-date:>=${sinceStr}&per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  const commitsData = commitsRes.ok
    ? await commitsRes.json()
    : { total_count: 0, items: [] };

  const activeDaysSet = new Set<string>();
  for (const item of commitsData.items || []) {
    activeDaysSet.add(item.commit.author.date.slice(0, 10));
  }

  const prsRes = await fetch(
    `${GITHUB_API}/search/issues?q=type:pr+author:${githubLogin}+created:>=${sinceStr}&per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  const prsData = prsRes.ok
    ? await prsRes.json()
    : { items: [] };

  let prsOpened = 0;
  let prsMerged = 0;
  for (const item of prsData.items || []) {
    if (item.state === "closed" && item.pull_request?.merged_at) {
      prsMerged++;
    } else {
      prsOpened++;
    }
  }

  return {
    commits: commitsData.total_count || 0,
    prsOpened,
    prsMerged,
    activeDays: activeDaysSet.size,
  };
}

async function dispatchEventForUser(
  userId: string,
  githubLogin: string,
  accessToken: string,
  event: string,
  days: number
): Promise<void> {
  const metrics = await getUserMetrics(githubLogin, accessToken, days);

  await dispatchToAllWebhooks(userId, event, {
    timestamp: new Date().toISOString(),
    period: days === 1 ? "daily" : "weekly",
    metrics: {
      commits: metrics.commits,
      prsOpened: metrics.prsOpened,
      prsMerged: metrics.prsMerged,
      activeDays: metrics.activeDays,
    },
  });
}

export async function GET(req: Request) {
  const sessionData = await getSessionWithToken();

  if (!sessionData || !sessionData.session.githubId || !sessionData.session.githubLogin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = sessionData.session;
  const accessToken = sessionData.accessToken;
  const githubLogin = session.githubLogin as string;
  const githubId = session.githubId as string;

  const user = await resolveAppUser(githubId, githubLogin);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "daily";

  try {
    if (period === "daily") {
      await dispatchEventForUser(
        user.id,
        githubLogin,
        accessToken,
        "daily.summary",
        1
      );
    } else if (period === "weekly") {
      await dispatchEventForUser(
        user.id,
        githubLogin,
        accessToken,
        "weekly.summary",
        7
      );
    } else {
      return NextResponse.json(
        { error: "Invalid period. Use 'daily' or 'weekly'" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      event: period === "daily" ? "daily.summary" : "weekly.summary",
      message: "Summary webhook dispatched",
    });
  } catch (err) {
    console.error("Failed to dispatch summary:", err);
    return NextResponse.json(
      { error: "Failed to dispatch summary" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.WEBHOOK_DISPATCH_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { event, userId, githubLogin, accessToken } = body;

  if (!event || !["daily.summary", "weekly.summary", "metrics.updated"].includes(event)) {
    return NextResponse.json(
      { error: "Invalid event type" },
      { status: 400 }
    );
  }

  if (!userId || !githubLogin || !accessToken) {
    return NextResponse.json(
      { error: "Missing required fields: userId, githubLogin, accessToken" },
      { status: 400 }
    );
  }

  const days = event === "daily.summary" ? 1 : 7;

  try {
    await dispatchEventForUser(userId, githubLogin, accessToken, event, days);

    return NextResponse.json({
      success: true,
      event,
      dispatched: 1,
    });
  } catch (err) {
    console.error("Failed to dispatch:", err);
    return NextResponse.json(
      { error: "Failed to dispatch webhook" },
      { status: 500 }
    );
  }
}