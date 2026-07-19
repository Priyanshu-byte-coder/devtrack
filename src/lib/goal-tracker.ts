type Recurrence = "none" | "weekly" | "monthly";

export interface CreateGoalPayload {
  title: string;
  target: number;
  unit: string;
  recurrence: Recurrence;
  deadline: string | null;
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
