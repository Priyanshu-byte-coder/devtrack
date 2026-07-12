import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { dispatchToAllWebhooks } from "@/lib/webhooks";
import { stripHtml } from "@/lib/sanitize";
import { createGoalSchema } from "@/lib/validations/goals";

export const dynamic = "force-dynamic";

interface Goal {  
  id: string;
  user_id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  recurrence: string;
  deadline: string | null;
  period_start: string | null;
  created_at: string;
  goal_reset_version: number;
  is_public: boolean;
}

interface GoalHistory {
  goal_id: string;
  period_start: string;
  period_end: string;
  target: number;
  achieved: number;
  completed: boolean;
}

type Recurrence = "none" | "weekly" | "monthly";

const VALID_RECURRENCES = ["none", "weekly", "monthly"] as const;
const MAX_TITLE_LEN = 100;
const MAX_UNIT_LEN = 30;
const MIN_TARGET = 1;
const MAX_TARGET = 10_000;

// Hard cap to prevent storage exhaustion and catastrophic Promise.all execution
const MAX_GOALS_PER_USER = 5;

function getPeriodStart(recurrence: Recurrence): string {
  const now = new Date();
  if (recurrence === "weekly") {
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diff);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.toISOString();
  }
  if (recurrence === "monthly") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
  return new Date(0).toISOString(); // 'none' never resets
}

function getPreviousPeriodEnd(periodStart: Date): string {
  return new Date(periodStart.getTime() - 1).toISOString();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Added .limit() to bound the database payload and the subsequent Promise.all loop
  const { data: goals, error } = await supabaseAdmin
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_GOALS_PER_USER);

  if (error) {
    console.error("Failed to fetch goals:", error);
    return Response.json({ error: "Failed to fetch goals" }, { status: 500 });
  }

  // Reset progress if we're in a new period
  const processedGoals = await Promise.all(
    (goals ?? []).map(async (goal: Goal) => {
      if (goal.recurrence === "none") return goal;

      const periodStart = new Date(getPeriodStart(goal.recurrence as Recurrence));
      const storedPeriodStart = goal.period_start
        ? new Date(goal.period_start)
        : new Date(0);

      if (storedPeriodStart < periodStart) {
        const oldVersion = goal.goal_reset_version ?? 0;

        const { error: historyError } = await supabaseAdmin
          .from("goal_history")
          .insert({
            goal_id: goal.id,
            user_id: goal.user_id,
            period_start: storedPeriodStart.toISOString(),
            period_end: getPreviousPeriodEnd(periodStart),
            target: goal.target,
            achieved: goal.current,
            completed: goal.current >= goal.target,
          });
        
        if (historyError && historyError.code !== "23505") {
          console.error("Failed to persist goal history before reset:", historyError);
          return goal;
        }
        
        const { data: updated, error } = await supabaseAdmin
          .from("goals")
          .update({
            current: 0,
            period_start: periodStart.toISOString(),
            goal_reset_version: oldVersion + 1,
            week_start: periodStart.toISOString().split("T")[0],
          })
          .eq("id", goal.id)
          .eq("goal_reset_version", oldVersion)
          .or(`period_start.lt.${periodStart.toISOString()},period_start.is.null`)
          .select()
          .single();
      
        if (updated) {
          return updated;
        }
      
        if (error) {
          console.warn("[GOAL_RESET_CONFLICT]", {
            goalId: goal.id,
            oldVersion,
            error,
          });
        }
      
        const { data: current } = await supabaseAdmin
          .from("goals")
          .select("*")
          .eq("id", goal.id)
          .single();
      
        return current ?? goal;
      }

      return goal;
    })
  );

  const goalIds = processedGoals
    .map((goal) => goal?.id)
    .filter((id): id is string => Boolean(id));

  let latestHistoryByGoal = new Map<string, GoalHistory>();
  if (goalIds.length > 0) {
    const { data: histories } = await supabaseAdmin
      .from("goal_history")
      .select("goal_id, period_start, period_end, target, achieved, completed")
      .eq("user_id", user.id)
      .in("goal_id", goalIds)
      .order("period_end", { ascending: false });

    latestHistoryByGoal = new Map<string, GoalHistory>();
    for (const history of (histories ?? []) as GoalHistory[]) {
      if (!latestHistoryByGoal.has(history.goal_id)) {
        latestHistoryByGoal.set(history.goal_id, history);
      }
    }
  }

  const goalsWithHistory = processedGoals.map((goal) => ({
    ...goal,
    last_period: latestHistoryByGoal.get(goal.id) ?? null,
  }));

  return Response.json({ goals: goalsWithHistory });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

try {
  body = await req.json();
} catch (e) {
  return Response.json({ error: "Invalid JSON" }, { status: 400 });
}


  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validationResult = createGoalSchema.safeParse(body);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0]?.message || "Invalid request body";
    return Response.json({ error: firstError }, { status: 400 });
  }

  const { title, target, unit, recurrence, deadline } = validationResult.data;

  const sanitizedTitle = stripHtml(title).trim();
  // Additional check after sanitization because HTML-only
  // strings like "<script></script>" pass min(1) but become empty.
  if (sanitizedTitle.length === 0) {
    return Response.json({ error: "title must not be empty" }, { status: 400 });
  }

  const safeUnit = unit;
  const safeRecurrence = recurrence;

  let safeDeadline: string | null = null;
  if (deadline) {
    const d = new Date(deadline);
    if (!isNaN(d.getTime())) {
      d.setUTCHours(23, 59, 59, 999);
      safeDeadline = d.toISOString();
    }
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { data: existing } = await supabaseAdmin
    .from("goals")
    .select("id")
    .eq("user_id", user.id)
    .ilike("title", sanitizedTitle)
    .maybeSingle();

  if (existing) {
    return Response.json(
      {
        error: "Task with this title already exists",
        code: "DUPLICATE_TASK_TITLE",
      },
      { status: 400 }
    );
  }

  // Pre-check count query using head option for peak performance
  const { count, error: countError } = await supabaseAdmin
    .from("goals")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return Response.json({ error: "Failed to verify goal limits" }, { status: 500 });
  }

  if ((count ?? 0) >= MAX_GOALS_PER_USER) {
    return Response.json(
      { error: `You can have at most ${MAX_GOALS_PER_USER} goals.` },
      { status: 400 }
    );
  }
  const { data: goal, error } = await supabaseAdmin
    .from("goals")
    .insert({
      user_id: user.id,
      title: sanitizedTitle,
      target,
      unit: safeUnit,
      recurrence: safeRecurrence,
      period_start: getPeriodStart(safeRecurrence),
      deadline: safeDeadline,
      current: 0,
      goal_reset_version: 0,
    })
    .select()
    .single();

  if (error) {
  return Response.json({ error: error.message }, { status: 500 });
}
  dispatchToAllWebhooks(user.id, "goal.created", {
    goalId: goal.id,
    title: goal.title,
    target: goal.target,
    unit: goal.unit,
    recurrence: goal.recurrence,
  }).catch(() => {});

  return Response.json({ goal }, { status: 201 });
}
