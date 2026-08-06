import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/resolve-user";
import {
  dispatchActivityAlert,
  isActivityAlertEvent,
  ACTIVITY_ALERT_EVENTS,
} from "@/lib/webhooks";

export const dynamic = "force-dynamic";

interface ActivityAlertBody {
  event: string;
  data?: Record<string, unknown>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.githubId || !session?.githubLogin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: ActivityAlertBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { event, data = {} } = body;

  if (!event || typeof event !== "string") {
    return NextResponse.json(
      {
        error: "Missing required field: event",
        validEvents: ACTIVITY_ALERT_EVENTS,
      },
      { status: 400 }
    );
  }

  if (!isActivityAlertEvent(event)) {
    return NextResponse.json(
      {
        error: `Invalid event '${event}'. Must be one of: ${ACTIVITY_ALERT_EVENTS.join(", ")}`,
        validEvents: ACTIVITY_ALERT_EVENTS,
      },
      { status: 400 }
    );
  }

  dispatchActivityAlert(user.id, event, {
    ...data,
    github_login: session.githubLogin,
    triggered_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    event,
    message: `Activity alert '${event}' queued for dispatch`,
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    events: ACTIVITY_ALERT_EVENTS,
    description:
      "Activity alert events trigger outbound webhooks when subscribed events occur in DevTrack.",
  });
}
