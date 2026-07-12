import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  // Verify project ownership
  const { data: project, error: projectError } = await supabaseAdmin
    .from("devtrack_projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch issues
  const { data: issues, error: issuesError } = await supabaseAdmin
    .from("devtrack_issues")
    .select("*")
    .eq("project_id", id)
    .order("issue_number", { ascending: true });

  if (issuesError) {
    console.error("Failed to fetch issues:", issuesError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ issues: issues || [] });
}

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

  // Verify project ownership
  const { data: project, error: projectError } = await supabaseAdmin
    .from("devtrack_projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const { title, description, status } = await req.json();

    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json({ error: "Issue title is required" }, { status: 400 });
    }

    const cleanStatus = status || "Todo";
    const validStatuses = ["Backlog", "Todo", "In Progress", "In Review", "Done"];
    if (!validStatuses.includes(cleanStatus)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    // Insert issue (issue_number auto-incremented by trigger)
    const { data: issue, error: issueError } = await supabaseAdmin
      .from("devtrack_issues")
      .insert({
        project_id: id,
        title: title.trim(),
        description: (description || "").trim(),
        status: cleanStatus,
      })
      .select("*")
      .single();

    if (issueError) {
      console.error("Failed to create issue:", issueError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Create activity for creation
    await supabaseAdmin.from("devtrack_issue_activities").insert({
      issue_id: issue.id,
      type: "status_change",
      content: `Issue created and set to status: ${cleanStatus}`,
    });

    return NextResponse.json(issue, { status: 201 });
  } catch (err) {
    console.error("Error creating issue:", err);
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
