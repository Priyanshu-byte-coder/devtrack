import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileThemeWrapper from "@/components/ProfileThemeWrapper";
import ClaimProfileButton from "@/components/profile/ClaimProfileButton";
import { buttonVariants } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim your profile",
  robots: { index: false, follow: false },
};

/**
 * Where "Claim this profile" on a guest page leads. Signing in creates the
 * account; this page then asks before publishing anything, because new
 * accounts start private.
 */
export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ login?: string | string[] }>;
}) {
  const { login: rawLogin } = await searchParams;
  const wanted = normalizeGitHubUsername(
    Array.isArray(rawLogin) ? rawLogin[0] : rawLogin
  );

  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    const back = wanted
      ? `/claim?login=${encodeURIComponent(wanted)}`
      : "/claim";
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  const { data: me } = await supabaseAdmin
    .from("users")
    .select("github_login, is_public, leaderboard_opt_in")
    .eq("github_id", session.githubId)
    .maybeSingle();

  const myLogin = me?.github_login ?? session.githubLogin ?? null;
  if (me?.is_public && me.leaderboard_opt_in && myLogin) {
    redirect(`/u/${myLogin.toLowerCase()}`);
  }

  const someoneElse =
    wanted && myLogin && wanted.toLowerCase() !== myLogin.toLowerCase();

  return (
    <ProfileThemeWrapper>
      <div className="flex justify-center px-4 py-16 text-[var(--foreground)]">
        <div className="w-full max-w-lg rounded-2xl border-2 border-[var(--accent)] bg-[var(--card)] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Claim your profile
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            {myLogin ? `Publish @${myLogin}` : "Publish your profile"}
          </h1>

          {someoneElse && (
            <p
              role="status"
              className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--control)] p-3 text-sm text-[var(--card-foreground)]"
            >
              You&apos;re signed in as @{myLogin}, so you can&apos;t claim @
              {wanted}. You can publish your own profile instead.
            </p>
          )}

          <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">
            This makes your DevTrack profile public and puts you on the
            leaderboard, with your tier, XP and README badges. You can make it
            private again any time in Settings.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {myLogin ? (
              <ClaimProfileButton login={myLogin} />
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                We couldn&apos;t find your account. Try signing in again.
              </p>
            )}
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline" })}
            >
              Not now
            </Link>
          </div>
        </div>
      </div>
    </ProfileThemeWrapper>
  );
}
