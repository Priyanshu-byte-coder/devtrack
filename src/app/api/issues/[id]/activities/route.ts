import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  // Verify issue ownership via project
  const { data: issue, error: issueError } = await supabaseAdmin
    .from("devtrack_issues")
    .select("id, devtrack_projects(user_id)")
    .eq("id", id)
    .single();

  if (issueError || !issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const project = issue.devtrack_projects as any;
  if (project.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { content } = await req.json();

    if (!content || typeof content !== "string" || content.trim() === "") {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    const { data: activity, error: insertError } = await supabaseAdmin
      .from("devtrack_issue_activities")
      .insert({
        issue_id: id,
        type: "comment",
        content: content.trim(),
        author_name: session.githubLogin || "User",
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Failed to insert comment activity:", insertError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    console.error("Error creating comment:", err);
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
