import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/accounts/link/:githubLogin
 * Removes a linked GitHub account identified by its GitHub login (username).
 * The primary account (the OAuth login account) cannot be unlinked.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ githubLogin: string }> }
) {
  const { githubLogin } = await params;

  const session = await getServerSession(authOptions);

  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Basic validation: GitHub logins are alphanumeric + hyphens, 1–39 chars
  if (
    !githubLogin ||
    typeof githubLogin !== "string" ||
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(githubLogin)
  ) {
    return NextResponse.json(
      { error: "Invalid githubLogin parameter" },
      { status: 400 }
    );
  }

  // Prevent unlinking the primary account
  if (githubLogin.toLowerCase() === session.githubLogin?.toLowerCase()) {
    return NextResponse.json(
      { error: "Cannot remove primary account" },
      { status: 400 }
    );
  }

  const userRow = await resolveAppUser(session.githubId, session.githubLogin);

  if (!userRow) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: deletedRows, error } = await supabaseAdmin
    .from("user_github_accounts")
    .delete()
    .eq("user_id", userRow.id)
    .ilike("github_login", githubLogin)
    .select("github_login");

  if (error) {
    console.error("DELETE /api/accounts/link/:githubLogin error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
