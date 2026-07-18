import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

interface LinkedAccountRow {
  id: string;
  github_id: string;
  github_login: string;
  added_at: string;
}

/**
 * GET /api/accounts
 * Returns all linked GitHub accounts for the authenticated user.
 * The primary (OAuth login) account is NOT included in this list —
 * only accounts linked via the "Link another account" flow.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRow = await resolveAppUser(session.githubId, session.githubLogin);

    if (!userRow) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: accounts, error } = await supabaseAdmin
      .from("user_github_accounts")
      .select("id, github_id, github_login, added_at")
      .eq("user_id", userRow.id)
      .order("added_at", { ascending: true });

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ accounts: [] });
      }
      console.error("Error fetching linked accounts:", error);
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      accounts: (accounts ?? []).map((row: LinkedAccountRow) => ({
        id: row.id,
        githubId: row.github_id,
        githubLogin: row.github_login,
        addedAt: row.added_at,
      })),
    });
  } catch (err) {
    console.error("Unexpected error in GET /api/accounts:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}