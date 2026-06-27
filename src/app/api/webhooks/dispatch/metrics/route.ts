import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/get-session-token";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { dispatchToAllWebhooks } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.WEBHOOK_DISPATCH_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, metrics } = body;

  if (!userId) {
    return NextResponse.json(
      { error: "Missing required field: userId" },
      { status: 400 }
    );
  }

  try {
    await dispatchToAllWebhooks(userId, "metrics.updated", {
      timestamp: new Date().toISOString(),
      metrics: metrics || {},
    });

    return NextResponse.json({
      success: true,
      event: "metrics.updated",
    });
  } catch (err) {
    console.error("Failed to dispatch metrics.updated:", err);
    return NextResponse.json(
      { error: "Failed to dispatch webhook" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const accessToken = await getAccessToken();
  if (!accessToken || !session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session?.githubId, session?.githubLogin);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const metricsData = searchParams.get("metrics");

  let parsedMetrics = {};
  if (metricsData) {
    try {
      parsedMetrics = JSON.parse(metricsData);
    } catch {
      return NextResponse.json(
        { error: "Invalid metrics JSON" },
        { status: 400 }
      );
    }
  }

  try {
    await dispatchToAllWebhooks(user.id, "metrics.updated", {
      timestamp: new Date().toISOString(),
      metrics: parsedMetrics,
    });

    return NextResponse.json({
      success: true,
      event: "metrics.updated",
    });
  } catch (err) {
    console.error("Failed to dispatch metrics.updated:", err);
    return NextResponse.json(
      { error: "Failed to dispatch" },
      { status: 500 }
    );
  }
}
