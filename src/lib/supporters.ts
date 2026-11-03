import "server-only";
import { unstable_cache } from "next/cache";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GitHub sponsors of DevTrack who have a public profile, for the supporters
 * wall. Sponsors with private profiles are never listed. is_sponsor is kept
 * in sync from GitHub Sponsors by /api/sponsors/sync.
 */
export const getPublicSupporters = unstable_cache(
  async (): Promise<string[]> => {
    if (process.env.PLAYWRIGHT_TEST === "true") return ["playwright-user"];
    if (!isSupabaseAdminAvailable) return [];
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("github_login")
      .eq("is_sponsor", true)
      .eq("is_public", true)
      .order("github_login")
      .limit(200);
    if (error || !data) return [];
    return data
      .map((row) => row.github_login)
      .filter(
        (login): login is string => typeof login === "string" && login !== ""
      );
  },
  ["public-supporters"],
  { revalidate: 3600, tags: ["supporters"] }
);
