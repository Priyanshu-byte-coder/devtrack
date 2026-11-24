import { NextRequest, NextResponse } from "next/server";
import { verifyGitHubWebhookSignature } from "@/lib/webhook-signature";
import { broadcastMetricInvalidation } from "@/lib/metric-events";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || "devtrack-default-webhook-secret";
  const signature = req.headers.get("x-hub-signature-256");

  const rawBody = await req.text();

  if (!verifyGitHubWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventType = req.headers.get("x-github-event");

  if (eventType === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  try {
    const payload = JSON.parse(rawBody);

    if (eventType === "push") {
      const username = payload.sender?.login || payload.pusher?.name;
      const repoName = payload.repository?.name;

      if (username) {
        broadcastMetricInvalidation(username, repoName);
        return NextResponse.json({ ok: true, invalidated: username });
      }
    }

    return NextResponse.json({ ok: true, processed: eventType });
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }
}
