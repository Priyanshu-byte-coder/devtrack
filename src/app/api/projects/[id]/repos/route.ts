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
    const { repo_url } = await req.json();

    if (!repo_url || typeof repo_url !== "string" || repo_url.trim() === "") {
      return NextResponse.json({ error: "Repository URL is required" }, { status: 400 });
    }

    let url: URL;
    try {
      url = new URL(repo_url.trim());
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    if (!["github.com", "gitlab.com"].includes(url.hostname.replace("www.", ""))) {
      return NextResponse.json({ error: "Only GitHub and GitLab repositories are supported" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("devtrack_repositories")
      .insert({
        project_id: id,
        repo_url: repo_url.trim(),
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") { // Unique violation
        return NextResponse.json({ error: "This repository is already linked to this project." }, { status: 409 });
      }
      console.error("Failed to link repository:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Error linking repository:", err);
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
