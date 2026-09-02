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

  // Fetch issue and project context to verify ownership
  const { data: issue, error: issueError } = await supabaseAdmin
    .from("devtrack_issues")
    .select("*, devtrack_projects(user_id, key, name)")
    .eq("id", id)
    .single();

  if (issueError || !issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  // Cast because of nested join type mapping
  const project = issue.devtrack_projects as any;
  if (project.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch activities
  const { data: activities, error: actError } = await supabaseAdmin
    .from("devtrack_issue_activities")
    .select("*")
    .eq("issue_id", id)
    .order("created_at", { ascending: true });

  if (actError) {
    console.error("Failed to fetch issue activities:", actError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Clean nested properties for client response
  const { devtrack_projects, ...cleanIssue } = issue;

  return NextResponse.json({
    issue: cleanIssue,
    project: {
      id: issue.project_id,
      name: project.name,
      key: project.key,
    },
    activities: activities || [],
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  // Fetch existing issue to verify ownership and check status change
  const { data: existingIssue, error: fetchError } = await supabaseAdmin
    .from("devtrack_issues")
    .select("*, devtrack_projects(user_id)")
    .eq("id", id)
    .single();

  if (fetchError || !existingIssue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const project = existingIssue.devtrack_projects as any;
  if (project.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, description, status } = await req.json();
    const updates: Record<string, any> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim() === "") {
        return NextResponse.json({ error: "Issue title cannot be empty" }, { status: 400 });
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = (description || "").trim();
    }

    let statusChanged = false;
    let oldStatus = existingIssue.status;
    if (status !== undefined) {
      const validStatuses = ["Backlog", "Todo", "In Progress", "In Review", "Done"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      if (status !== oldStatus) {
        updates.status = status;
        statusChanged = true;
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedIssue, error: updateError } = await supabaseAdmin
      .from("devtrack_issues")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Failed to update issue:", updateError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Insert status change activity
    if (statusChanged) {
      await supabaseAdmin.from("devtrack_issue_activities").insert({
        issue_id: id,
        type: "status_change",
        content: `Status changed from ${oldStatus} to ${status}`,
      });
    }

    return NextResponse.json(updatedIssue);
  } catch (err) {
    console.error("Error updating issue:", err);
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
