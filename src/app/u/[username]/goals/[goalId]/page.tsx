import Link from "next/link";
import ProfileThemeWrapper from "@/components/ProfileThemeWrapper";
import { supabaseAdmin } from "@/lib/supabase";
import { getGoalProgressPercent } from "@/lib/goals/share";

export const dynamic = "force-dynamic";

interface PublicGoal {
  id: string;
  user_id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  recurrence: string | null;
  deadline: string | null;
  is_public: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

function formatDate(date: string | null) {
  if (!date) return "No deadline";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; goalId: string }>;
}) {
  const { username } = await params;

  return {
    title: `${username}'s shared goal | DevTrack`,
    description: `View ${username}'s shared DevTrack goal progress.`,
  };
}

export default async function PublicGoalPage({
  params,
}: {
  params: Promise<{ username: string; goalId: string }>;
}) {
  const { username, goalId } = await params;

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id,github_login")
    .ilike("github_login", username)
    .single();

  if (userError || !user) {
    return <GoalUnavailable username={username} />;
  }

  const { data: goal, error: goalError } = await supabaseAdmin
    .from("goals")
    .select(
      "id,user_id,title,target,current,unit,recurrence,deadline,is_public,created_at,updated_at"
    )
    .eq("id", goalId)
    .eq("user_id", user.id)
    .eq("is_public", true)
    .single();

  if (goalError || !goal) {
    return <GoalUnavailable username={username} />;
  }

  const sharedGoal = goal as PublicGoal;
  const progress = getGoalProgressPercent(sharedGoal.current, sharedGoal.target);

  return (
    <ProfileThemeWrapper>
      <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--foreground)] md:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-soft)] md:p-8">
          <div className="mb-6">
            <p className="text-sm font-medium text-[var(--muted-foreground)]">
              Shared DevTrack Goal
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--card-foreground)]">
              {sharedGoal.title}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              @{user.github_login}
            </p>
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-[var(--card-foreground)]">
                Progress
              </span>
              <span className="text-[var(--muted-foreground)]">
                {progress}%
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-[var(--control)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              {sharedGoal.current} / {sharedGoal.target} {sharedGoal.unit}
            </p>
          </div>

          <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--control)] p-4 text-sm md:grid-cols-2">
            <div>
              <p className="text-[var(--muted-foreground)]">Deadline</p>
              <p className="font-medium text-[var(--card-foreground)]">
                {formatDate(sharedGoal.deadline)}
              </p>
            </div>

            <div>
              <p className="text-[var(--muted-foreground)]">Recurrence</p>
              <p className="font-medium capitalize text-[var(--card-foreground)]">
                {sharedGoal.recurrence ?? "none"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/u/${encodeURIComponent(user.github_login)}`}
              className="secondary-button rounded-lg px-4 py-2 text-sm font-semibold"
            >
              View public profile
            </Link>

            <Link
              href="/"
              className="primary-button rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Create your own goals
            </Link>
          </div>
        </div>
      </main>
    </ProfileThemeWrapper>
  );
}

function GoalUnavailable({ username }: { username: string }) {
  return (
    <ProfileThemeWrapper>
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 text-[var(--foreground)]">
        <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-[var(--shadow-soft)]">
          <h1 className="text-3xl font-bold text-[var(--card-foreground)]">
            Goal Not Available
          </h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            This goal is private, revoked, or does not exist.
          </p>
          <Link
            href={`/u/${encodeURIComponent(username)}`}
            className="primary-button mt-6 inline-block rounded-lg px-5 py-2 text-sm font-semibold"
          >
            Back to profile
          </Link>
        </div>
      </main>
    </ProfileThemeWrapper>
  );
}