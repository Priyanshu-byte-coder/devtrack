import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchPinnedRepoDetails } from "@/lib/pinned-repos";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin || !session.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch user's pinned_repos array from Supabase
    const { data: userRow, error } = await supabaseAdmin
      .from("users")
      .select("pinned_repos")
      .eq("github_id", session.githubId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json({ pinnedRepos: [] });
      }
      console.error("Failed to fetch pinned repos from database:", error);
      return Response.json(
        { error: "Failed to load pinned repositories" },
        { status: 500 }
      );
    }

    if (!userRow) {
      return Response.json({ pinnedRepos: [] });
    }

    const pinnedReposArray = userRow.pinned_repos || [];
    if (pinnedReposArray.length === 0) {
      return Response.json({ pinnedRepos: [] });
    }

    // 2. Load fresh repository metadata and 30-day sparkline counts from GitHub API
    const details = await fetchPinnedRepoDetails(
      session.githubLogin,
      pinnedReposArray,
      session.accessToken
    );

    return Response.json({ pinnedRepos: details });
  } catch (err) {
    console.error("Failed to load pinned repos details:", err);
    return Response.json({ error: "Failed to load pinned repositories" }, { status: 502 });
  }
}
