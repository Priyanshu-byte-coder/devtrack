
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyGitHubSignature } from "@/lib/crypto";
import { logError } from "@/lib/error-handler";
import { sendSSEEvent } from "@/lib/sse";
import { invalidateUserMetricsCache } from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";

const SIGNATURE_HEADER = "x-hub-signature-256";
const GITHUB_EVENT_HEADER = "x-github-event";
const DELIVERY_HEADER = "x-github-delivery";
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

const recentDeliveries = new Map<string, number>();

interface GitHubPushPayload {
  after?: string;
  commits?: Array<unknown>;
  pusher?: {
    name?: string;
  };
  repository?: {
    full_name?: string;
  };
  sender?: {
    login?: string;
  };
}

function isReplayRequest(deliveryId: string | null): boolean {
  if (!deliveryId) {
    return true;
  }

  const now = Date.now();

  for (const [id, timestamp] of recentDeliveries) {
    if (now - timestamp > REPLAY_WINDOW_MS) {
      recentDeliveries.delete(id);
    }
  }

  if (recentDeliveries.has(deliveryId)) {
    return true;
  }

  recentDeliveries.set(deliveryId, now);
  return false;
}

function getPushActor(payload: GitHubPushPayload): string | null {
  return payload.sender?.login ?? payload.pusher?.name ?? null;
}

async function markUserMetricsStale(githubLogin: string) {
  const updatedAt = new Date().toISOString();

  const { data: primaryUser, error: primaryError } = await supabaseAdmin
    .from("users")
    .update({ updated_at: updatedAt })
    .eq("github_login", githubLogin)
    .select("id, github_id")
    .maybeSingle();

  if (primaryError) throw primaryError;

  if (primaryUser) {
    return { userId: primaryUser.id as string, githubId: String(primaryUser.github_id), accountType: "primary" };
  }

  const { data: linkedAccount, error: linkedError } = await supabaseAdmin
    .from("user_github_accounts")
    .select("user_id, github_id")
    .eq("github_login", githubLogin)
    .maybeSingle();

  if (linkedError) throw linkedError;

  if (!linkedAccount?.user_id) return null;

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ updated_at: updatedAt })
    .eq("id", linkedAccount.user_id);

  if (updateError) throw updateError;

  return { userId: linkedAccount.user_id as string, githubId: String(linkedAccount.github_id), accountType: "linked" };
}

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "GitHub webhook secret is not configured" },
      { status: 500 }
    );
  }

  const body = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER);
  const deliveryId = req.headers.get(DELIVERY_HEADER);

  if (isReplayRequest(deliveryId)) {
    return NextResponse.json(
      { error: "Replay request detected" },
      { status: 401 }
    );
  }

  if (!verifyGitHubSignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get(GITHUB_EVENT_HEADER);
  if (event !== "push") {
    return NextResponse.json({ received: true });
  }

  let payload: GitHubPushPayload;
  try {
    payload = JSON.parse(body) as GitHubPushPayload;
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const githubLogin = getPushActor(payload);
  if (!githubLogin) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  let staleResult: Awaited<ReturnType<typeof markUserMetricsStale>>;
  try {
    staleResult = await markUserMetricsStale(githubLogin);
  } catch (error) {
    logError(error, {
      endpoint: "/api/webhooks/github",
      operation: "mark_metrics_stale",
      userId: githubLogin,
      additionalContext: {
        repository: payload.repository?.full_name,
        commitCount: payload.commits?.length,
      },
    });
    return NextResponse.json(
      { error: "Failed to trigger metric refresh" },
      { status: 500 }
    );
  }

  if (staleResult) {
    await invalidateUserMetricsCache(githubLogin);
    if (staleResult.githubId) {
      await invalidateUserMetricsCache(staleResult.githubId);
    }

    sendSSEEvent(staleResult.userId, "commit", {
      repo: payload.repository?.full_name,
      timestamp: new Date().toISOString(),
    });
    revalidatePath(`/u/${githubLogin}`);
    revalidatePath("/dashboard");
  }

  return NextResponse.json({ received: true });
}
