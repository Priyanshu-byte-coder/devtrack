import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { dispatchToAllWebhooks } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

// Goals whose progress is derived from verified GitHub activity.
// The sync endpoint (/api/goals/sync) is the sole authority for these values;
// client-supplied progress updates must be rejected to prevent fabrication.
const ACTIVITY_DERIVED_UNITS = new Set(["commits", "prs", "repositories", "streak"]);

// Canonical recurrence values — must stay in sync with the POST route and
// the GET period-reset logic, neither of which has a branch for "daily".
// Accepting "daily" here would write an unrecognised value to the DB that
// the reset logic silently ignores, leaving the goal stuck forever.
const VALID_RECURRENCES = ["none", "weekly", "monthly"] as const;
type Recurrence = (typeof VALID_RECURRENCES)[number];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  const { title, target, unit, recurrence, current, is_public, deadline } =
    body as Record<string, unknown>;

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return Response.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    if (title.length > 100) {
      return Response.json({ error: "title must be 100 characters or fewer" }, { status: 400 });
    }
    updates.title = title.trim();
  }

  if (target !== undefined) {
    if (
      typeof target !== "number" ||
      !Number.isInteger(target) ||
      target < 1 ||
      target > 10_000
    ) {
      return Response.json(
        { error: "target must be an integer between 1 and 10000" },
        { status: 400 }
      );
    }
    updates.target = target;
  }

  if (unit !== undefined) {
    if (typeof unit !== "string" || unit.trim().length === 0) {
      return Response.json({ error: "unit must be a non-empty string" }, { status: 400 });
    }
    updates.unit = unit.trim();
  }

  if (recurrence !== undefined) {
    if (!VALID_RECURRENCES.includes(recurrence as Recurrence)) {
      return Response.json(
        { error: "recurrence must be 'none', 'weekly', or 'monthly'" },
        { status: 400 }
      );
    }
    updates.recurrence = recurrence;
  }

  if (current !== undefined) {
    if (typeof current !== "number" || !Number.isInteger(current) || current < 0) {
      return Response.json(
        { error: "current must be a non-negative integer" },
        { status: 400 }
      );
    }
    updates.current = current;
  }
  
  if (is_public !== undefined) {
    if (typeof is_public !== "boolean") {
      return Response.json(
        { error: "is_public must be a boolean" },
        { status: 400 }
      );
    }

    updates.is_public = is_public;
  }

  if (deadline !== undefined) {
    if (deadline === null) {
      updates.deadline = null;
    } else if (typeof deadline === "string") {
      const d = new Date(deadline);
      if (!isNaN(d.getTime())) {
        d.setUTCHours(23, 59, 59, 999);
        updates.deadline = d.toISOString();
      } else {
        return Response.json({ error: "Invalid deadline date format" }, { status: 400 });
      }
    } else {
      return Response.json({ error: "deadline must be a string or null" }, { status: 400 });
    }
  }

  const { data: existingGoal } = await supabaseAdmin
    .from("goals")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existingGoal) {
    return Response.json({ error: "Goal not found" }, { status: 404 });
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ goal: existingGoal });
  }

  // Block manual progress edits for activity-derived goal types.
  // These goals are synced from GitHub and setting current directly would
  // allow goal completion without any corresponding real activity.
  if (current !== undefined && ACTIVITY_DERIVED_UNITS.has(existingGoal.unit)) {
    return Response.json(
      {
        error:
          "Progress for activity-derived goals is updated automatically via GitHub sync.",
      },
      { status: 422 }
    );
  }

  if (typeof current === "number" && current > existingGoal.target) {
    return Response.json(
      { error: "current cannot exceed target" },
      { status: 400 }
    );
  }

  const wasCompleted = existingGoal.current >= existingGoal.target;
  const { data: updatedGoal, error } = await supabaseAdmin
    .from("goals")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return Response.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }

  const isNowCompleted = updatedGoal.current >= updatedGoal.target;

  if (!wasCompleted && isNowCompleted) {
    dispatchToAllWebhooks(user.id, "goal.completed", {
      goalId: updatedGoal.id,
      title: updatedGoal.title,
      target: updatedGoal.target,
      unit: updatedGoal.unit,
      recurrence: updatedGoal.recurrence,
      completedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  return Response.json({ goal: updatedGoal });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.githubId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await resolveAppUser(session.githubId, session.githubLogin);
    if (!user) {
      console.error("Failed to resolve user for goals DELETE:", {
        githubId: session.githubId,
      });
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Only delete if the goal belongs to the authenticated user
    const { error } = await supabaseAdmin
      .from("goals")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting goal:", error);
      return Response.json({ error: "Failed to delete goal" }, { status: 500 });
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in goals DELETE:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
