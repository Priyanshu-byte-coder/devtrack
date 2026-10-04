import { type NextAuthOptions, type DefaultSession, type Account, type Profile, type User } from "next-auth";
import { type JWT } from "next-auth/jwt";
import GitHubProvider from "next-auth/providers/github";
import { syncGitHubAchievementsForUser } from "@/lib/github-achievements";
import { supabaseAdmin } from "@/lib/supabase";

// --- Interfaces & Types ---

/**
 * Explicitly typed GitHub profile to replace implicit any access.
 */
interface GitHubProfile extends Profile {
  id: number;
  login: string;
  email?: string;
  avatar_url?: string;
}

/**
 * Extend NextAuth modules to include our custom session/token properties.
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    githubId?: string;
    githubLogin?: string;
    error?: "TokenRevoked";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenValidatedAt?: number;
    githubId?: string;
    githubLogin?: string;
    error?: "TokenRevoked";
  }
}

// --- Configuration ---

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const SESSION_UPDATE_AGE = 24 * 60 * 60;
const TOKEN_VALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const GITHUB_API = "https://api.github.com";
const isPlaywrightServer = process.env.PLAYWRIGHT_SERVER_MODE === "start";

export const authOptions: NextAuthOptions = {
  // Playwright runs on plain HTTP (127.0.0.1); secure cookie prefixes break E2E session reads.
  // NextAuth infers HTTPS via forwarded headers, switching to secure cookie prefixes which prevents
  // the session cookie from being read on local HTTP setups. Force non-secure cookies in this mode.
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
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  callbacks: {
    /**
     * signIn: Validates user identity and performs best-effort DB synchronization.
     * Uses explicit type assertions and defensive checks for Supabase connectivity.
     */
    async signIn({ account, profile }): Promise<boolean> {
      if (account?.provider === "github" && profile) {
        const githubProfile = profile as GitHubProfile;

        if (!supabaseAdmin) {
          console.warn("[auth] supabaseAdmin not configured; skipping DB upsert.");
          return true;
        }

        try {
          let { data: user, error: upsertError } = await supabaseAdmin
            .from("users")
            .upsert(
              {
                github_id: String(githubProfile.id),
                github_login: githubProfile.login,
                email: githubProfile.email ?? null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "github_id" }
            )
            .select("id")
            .single();

         // Resilience: handle schema-mismatched errors (42703) during migrations.
          // 42703 = column does not exist - email column migration may still be pending
          if (upsertError && upsertError.code === "42703") {
            const { data: fallbackUser, error: fallbackError } = await supabaseAdmin
              .from("users")
              .upsert({
                github_id: String(githubProfile.id),
                github_login: githubProfile.login,
                updated_at: new Date().toISOString(),
              }, { onConflict: "github_id" })
              .select("id")
              .single();

            if (fallbackError) {
              console.error("[auth] Supabase fallback upsert error:", fallbackError);
            } else {
              user = fallbackUser; // Re-assign pointer to prevent skipping synchronization loop
            }
          } else if (upsertError) {
            console.error("[auth] Supabase primary upsert error:", upsertError);
          }

          if (user?.id && account.access_token) {
            await syncGitHubAchievementsForUser({
              userId: user.id as string,
              githubLogin: githubProfile.login,
              token: account.access_token,
              force: true,
            }).catch((err: unknown) => console.error("[auth] Sync failed:", err));
          }
        } catch (error) {
          console.error("[auth] Non-fatal signIn callback error:", error);
        }
      }
      return true;
    },

    /**
     * jwt: Handles persistent token management and liveness verification.
     */
    async jwt({ token, account, profile, user }) {
      const jwtToken = token as JWT;

      if (account?.access_token) {
        jwtToken.accessToken = account.access_token;
        jwtToken.accessTokenValidatedAt = Date.now();
      } else if (user && (user as any).accessToken) {
        // Reinstate critical regression fallback: propagate token from custom user sign-in paths
        jwtToken.accessToken = (user as any).accessToken;
        jwtToken.accessTokenValidatedAt = Date.now();
      }

      if (profile) {
        const p = profile as GitHubProfile;
        jwtToken.githubId = String(p.id);
        jwtToken.githubLogin = p.login;
      } else if (user && !jwtToken.githubId) {
        jwtToken.githubId = user.id;

        const u = user as unknown as Record<string, unknown>;
        const loginCandidate =
          typeof u.login === "string" ? u.login :
          typeof u.github_login === "string" ? u.github_login :
          typeof u.name === "string" ? u.name :
          undefined;

        // Secure Production Guard: do not assign fallback 'mock-user' sentinels.
        // Leave undefined so upstream callers can detect and handle the missing value properly.
        jwtToken.githubLogin = loginCandidate;
      }

      // Perform periodic liveness checks for token revocation
      if (
        !account &&
        jwtToken.accessToken &&
        typeof jwtToken.accessTokenValidatedAt === "number" &&
        !jwtToken.error &&
        Date.now() - jwtToken.accessTokenValidatedAt > TOKEN_VALIDATION_INTERVAL_MS
      ) {
        try {
          const res = await fetch(`${GITHUB_API}/user`, {
            headers: { Authorization: `Bearer ${jwtToken.accessToken}` },
            cache: "no-store",
          });
          if (res.status === 401) {
            jwtToken.error = "TokenRevoked";
          } else if (res.ok) {
            jwtToken.accessTokenValidatedAt = Date.now();
          }
          // Note: Network timeouts or transient GitHub API downtime will not advance 
          // accessTokenValidatedAt. This guarantees a retry on the next route hit.
        } catch {
          // Failure to reach GitHub does not invalidate session; retry on next hit
        }
      }

      return jwtToken;
    },

    /**
     * session: Exposes validated token/profile data to the client.
     */
    async session({ session, token }) {
      const jwtToken = token as JWT;
      session.accessToken = jwtToken.accessToken;
      session.githubId = jwtToken.githubId;
      session.githubLogin = jwtToken.githubLogin;
      session.error = jwtToken.error;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
