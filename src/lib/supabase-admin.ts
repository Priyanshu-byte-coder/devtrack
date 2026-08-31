import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client using the service role key.
 *
 * IMPORTANT: This file must NEVER be imported in client components.
 * The `import "server-only"` directive enforces this at build time —
 * Next.js will throw a hard error if it is ever bundled into the client.
 *
 * The service role key bypasses all Row Level Security (RLS) policies.
 * Use this client only in:
 *   - API route handlers (src/app/api/**)
 *   - Server Actions
 *   - Server Components that require privileged DB access
 */

function getValidatedAdminEnv(): { url: string; serviceRoleKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    url.includes("placeholder") ||
    !serviceRoleKey ||
    serviceRoleKey.includes("placeholder")
  ) {
    return null;
  }

  return { url, serviceRoleKey };
}

export const isSupabaseAdminAvailable = !!getValidatedAdminEnv();

export const SUPABASE_ADMIN_UNAVAILABLE_MESSAGE =
  "Supabase admin client is unavailable. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.";

// eslint-disable-next-line
type SupabaseAdminClient = SupabaseClient<any, any, any>;

function createUnavailableSupabaseAdmin(): SupabaseAdminClient {
  return {
    from() {
      throw new Error(SUPABASE_ADMIN_UNAVAILABLE_MESSAGE);
    },
  } as unknown as SupabaseAdminClient;
}

// Do not throw here — build-time rendering can touch this module before
// runtime environment variables are present. Guard call sites instead.
const env = getValidatedAdminEnv();

export const supabaseAdmin: SupabaseAdminClient = env
  ? createClient(env.url, env.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createUnavailableSupabaseAdmin();

// ─── User helpers ────────────────────────────────────────────────────────────

interface User {
  id: string;
  github_id: string;
  github_login: string;
  bio: string | null;
  is_public: boolean;
  public_since?: string | null;
  show_weekly_goals?: boolean;
  pinned_repos?: string[];
  created_at: string;
  updated_at: string;
  is_sponsor?: boolean;
  timezone?: string;
}

/**
 * Look up a user by GitHub username only if their profile is public.
 * Returns the user row if found and is_public is true, otherwise null.
 */
export async function getUserByUsername(
  username: string
): Promise<User | null> {
  if (!username || !username.trim()) {
    return null;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "id,github_id,github_login,bio,is_public,pinned_repos,created_at,updated_at,is_sponsor,timezone"
      )
      .ilike("github_login", username)
      .eq("is_public", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      // Optional columns (pinned_repos, is_sponsor) may not exist yet — fall back
      if (error.code === "42703") {
        const { data: minimal, error: minError } = await supabaseAdmin
          .from("users")
          .select("id,github_id,github_login,is_public,created_at,updated_at,timezone")
          .ilike("github_login", username)
          .eq("is_public", true)
          .single();

        if (minError) {
          if (minError.code === "PGRST116") return null;
          console.error("Error fetching user (minimal):", minError);
          return null;
        }

        return { ...(minimal as User), bio: null };
      }
      console.error("Error fetching user:", error);
      return null;
    }

    return data as User;
  } catch (err) {
    console.error("Unexpected error fetching user:", err);
    return null;
  }
}

/**
 * Look up a user by GitHub id. Used for authenticated server-rendered pages
 * where the session has an id but may not have the login claim populated.
 */
export async function getUserByGithubId(
  githubId: string
): Promise<User | null> {
  if (!isSupabaseAdminAvailable) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id,github_id,github_login,is_public,created_at,updated_at")
      .eq("github_id", githubId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching user by GitHub id:", error);
      return null;
    }

    return data as User;
  } catch (err) {
    console.error("Unexpected error fetching user by GitHub id:", err);
    return null;
  }
}

/**
 * Update the is_public flag for a user.
 */
export async function updateUserPublicFlag(
  userId: string,
  isPublic: boolean
): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ is_public: isPublic })
      .eq("id", userId)
      .select("id,github_id,github_login,bio,is_public,created_at,updated_at")
      .single();

    if (error) {
      console.error("Error updating user public flag:", error);
      return null;
    }

    return data as User;
  } catch (err) {
    console.error("Unexpected error updating public flag:", err);
    return null;
  }
}