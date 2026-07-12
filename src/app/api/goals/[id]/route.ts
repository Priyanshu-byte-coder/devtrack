import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { dispatchToAllWebhooks } from "@/lib/webhooks";
import { patchGoalSchema } from "@/lib/validations/goals";

export const dynamic = "force-dynamic";

// Goals whose progress is derived from verified GitHub activity.
// The sync endpoint (/api/goals/sync) is the sole authority for these values;
// client-supplied progress updates must be rejected to prevent fabrication.
const ACTIVITY_DERIVED_UNITS = new Set(["commits", "prs"]);

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

  const validationResult = patchGoalSchema.safeParse(body);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0]?.message || "Invalid request body";
    return Response.json({ error: firstError }, { status: 400 });
  }

  const { title, target, unit, recurrence, current, is_public } = validationResult.data;

  const updates: Record<string, unknown> = {};

  if (title !== undefined) {
    updates.title = title.trim();
  }

  if (target !== undefined) {
    updates.target = target;
  }

  if (unit !== undefined) {
    updates.unit = unit;
  }

  if (recurrence !== undefined) {
    updates.recurrence = recurrence;
  }

  if (current !== undefined) {
    updates.current = current;
  }
  
  if (is_public !== undefined) {
    updates.is_public = is_public;
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

  const finalTarget = target !== undefined ? target : existingGoal.target;
  const finalCurrent = current !== undefined ? current : existingGoal.current;

  if (finalCurrent > finalTarget) {
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
