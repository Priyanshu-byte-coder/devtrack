type Recurrence = "none" | "weekly" | "monthly";
export type GoalCategory = "side-project" | "work" | "dsa" | "open-source";

export interface CreateGoalPayload {
  title: string;
  target: number;
  unit: string;
  recurrence: Recurrence;
  deadline: string | null;
  category?: GoalCategory | null;
}

interface SubmitGoalOptions {
  fetchImpl?: typeof fetch;
  payload: CreateGoalPayload;
  handleSync: () => Promise<unknown>;
  loadGoals: () => Promise<unknown>;
}

export interface SubmitGoalResult {
  created: boolean;
  error: string | null;
}

export async function submitGoalWithRefresh({
  fetchImpl = fetch,
  payload,
  handleSync,
  loadGoals,
}: SubmitGoalOptions): Promise<SubmitGoalResult> {
  let response: Response;

  try {
    response = await fetchImpl("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return {
      created: false,
      error: "Failed to create goal. Please try again.",
    };
  }

  if (!response.ok) {
    let message = "Failed to create goal. Please try again.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep fallback message
    }
    return {
      created: false,
      error: message,
    };
  }

  try {
    if (payload.unit === "commits" || payload.unit === "prs") {
      await handleSync();
    } else {
      await loadGoals();
    }
  } catch (e) {
    return {
      created: true,
      error: "Goal created, but refreshing goals failed. Please try refreshing.",
    };
  }

  return {
    created: true,
    error: null,
  };
}

export type GoalStatusFilter = "all" | "active" | "completed";

interface FilterableGoal {
  title: string;
  target: number;
  current: number;
  category?: GoalCategory | null;
}

export interface GoalFilters {
  query?: string;
  status?: GoalStatusFilter;
  category?: GoalCategory | null;
}

/**
 * Narrows a goal list by title search, completion status and category.
 * All provided filters must match. The title match is case-insensitive and
 * ignores surrounding whitespace in the query.
 */
export function filterGoals<T extends FilterableGoal>(
  goals: T[],
  { query = "", status = "all", category = null }: GoalFilters
): T[] {
  const needle = query.trim().toLowerCase();
  return goals.filter((goal) => {
    if (needle && !goal.title.toLowerCase().includes(needle)) return false;
    if (category && goal.category !== category) return false;
    const completed = goal.current >= goal.target;
    if (status === "active") return !completed;
    if (status === "completed") return completed;
    return true;
  });
}

/** The search box is only useful once the list is longer than this. */
export const GOAL_SEARCH_MIN_GOALS = 5;

export interface GoalFilterVisibility {
  search: boolean;
  status: boolean;
}

/**
 * Decides which filter controls can actually narrow the list: search needs
 * more than GOAL_SEARCH_MIN_GOALS goals, the status tabs need at least one
 * active and one completed goal.
 */
export function shouldShowGoalFilters(
  goals: Pick<FilterableGoal, "target" | "current">[]
): GoalFilterVisibility {
  const completed = goals.filter((goal) => goal.current >= goal.target).length;
  return {
    search: goals.length > GOAL_SEARCH_MIN_GOALS,
    status: completed > 0 && completed < goals.length,
  };
}
