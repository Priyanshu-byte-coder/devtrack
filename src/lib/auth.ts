import { type NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { syncGitHubAchievementsForUser } from "./github-achievements";
import { supabaseAdmin } from "./supabase";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const SESSION_UPDATE_AGE = 24 * 60 * 60;
const isPlaywrightServer = process.env.PLAYWRIGHT_SERVER_MODE === "start";

const GITHUB_API = "https://api.github.com";
// Re-validate the stored GitHub token at most once every 24 hours per session.
// Catches revocations within a reasonable window without adding per-request latency.
// Without this check a revoked token silently continues for up to 30 days (JWT lifetime).
const TOKEN_VALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  // Playwright runs on plain HTTP (127.0.0.1) and relies on the default
  // `next-auth.session-token` cookie name. If NextAuth infers HTTPS via
  // forwarded headers, it may switch to secure cookie prefixes and the E2E
  // session cookie won't be read. Force non-secure cookies in this mode.
  ...(isPlaywrightServer ? { useSecureCookies: false } : {}),
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
      authorization: {
        params: { scope: "read:user user:email repo read:discussion read:org" },
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  // Use NextAuth's default cookie behavior (secure cookies on HTTPS deployments),
  // which keeps Playwright E2E (http://127.0.0.1) aligned with the default
  // `next-auth.session-token` cookie name.
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "github" && profile) {
        const p = profile as { id: number; login: string; email?: string };

        // Guard: supabaseAdmin is null when Supabase env vars are missing or
        // contain placeholder values (see src/lib/supabase.ts). Calling .from()
        // on null throws a TypeError which NextAuth silently converts to
        // return false → error=github redirect. Skip the upsert gracefully
        // so authentication can still succeed with degraded functionality.
        if (!supabaseAdmin) {
          console.warn(
            "signIn: supabaseAdmin is not configured; skipping DB upsert. " +
            "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
          );
          return true;
        }

        try {
          let { data: user, error: upsertError } = await supabaseAdmin
            .from("users")
            .upsert(
              {
                github_id: String(p.id),
                github_login: p.login,
                email: p.email || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "github_id" }
            )
            .select("id")
            .single();

          // If the email column does not exist yet (migration pending),
          // PostgREST returns a 42703 error. Fallback to upsert without email.
          if (upsertError && (upsertError as { code?: string }).code === "42703") {
            const fallback = await supabaseAdmin
              .from("users")
              .upsert(
                {
                  github_id: String(p.id),
                  github_login: p.login,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "github_id" }
              )
              .select("id")
              .single();
            user = fallback.data;
            upsertError = fallback.error;
          }

          if (upsertError) {
            console.error("[auth] Supabase upsert error:", upsertError);
          }

          if (user?.id && account.access_token) {
            try {
              await syncGitHubAchievementsForUser({
                userId: user.id,
                githubLogin: p.login,
                token: account.access_token,
                force: true,
              });
            } catch (error) {
              console.error("[auth] GitHub achievements sync failed:", error);
            }
          }
        } catch (error) {
          // Database failures must not block sign-in — the user is authenticated
          // by GitHub; local sync is best-effort.
          console.error("[auth] signIn callback error (non-fatal):", error);
        }
      }
      return true;
    },
    async jwt({ token, account, profile, user }) {
      // account is only populated on the initial sign-in; all subsequent JWT
      // refreshes arrive here with account === undefined.
      if (account?.access_token) {
        token.accessToken = account.access_token;
        // Record when we first obtained and validated this token so we know
        // when the next liveness check is due.
        token.accessTokenValidatedAt = Date.now();
      } else if (user && (user as any).accessToken) {
        token.accessToken = (user as any).accessToken;
        token.accessTokenValidatedAt = Date.now();
      }
      if (profile) {
        const p = profile as { id: number; login: string };
        token.githubId = String(p.id);
        token.githubLogin = p.login;
      } else if (user) {
        token.githubId = user.id;
        token.githubLogin = (user as any).login || "mock-user";
      }

      // Periodic token liveness check: if more than TOKEN_VALIDATION_INTERVAL_MS
      // has elapsed since the last successful validation, hit GET /user with the
      // stored token. A 401 response means the user has revoked access via GitHub
      // Settings — flag the token so the dashboard can force re-authentication.
      if (
        !account &&
        typeof token.accessToken === "string" &&
        typeof token.accessTokenValidatedAt === "number" &&
        !token.error &&
        Date.now() - token.accessTokenValidatedAt > TOKEN_VALIDATION_INTERVAL_MS
      ) {
        try {
          const res = await fetch(`${GITHUB_API}/user`, {
            headers: { Authorization: `Bearer ${token.accessToken}` },
            cache: "no-store",
          });
          if (res.status === 401) {
            // Explicit revocation: mark the session for forced sign-out.
            token.error = "TokenRevoked";
          } else if (res.ok) {
            // Only advance the timestamp on a confirmed-good response; transient
            // errors (429, 5xx) should be retried on the next request, not cached
            // as a successful validation.
            token.accessTokenValidatedAt = Date.now();
          }
          // Non-401 non-ok responses (rate limit, server error) are intentionally
          // left without updating accessTokenValidatedAt so the next request retries.
        } catch (e) {
          // Network failures during validation are not treated as revocation.
          // The check will be retried on the next request.
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (typeof token.accessToken === "string")
        session.accessToken = token.accessToken;
      if (typeof token.githubId === "string")
        session.githubId = token.githubId;
      if (typeof token.githubLogin === "string")
        session.githubLogin = token.githubLogin;
      // Surface the revocation flag so pages can redirect to re-authentication.
      if (token.error === "TokenRevoked")
        session.error = "TokenRevoked";
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
