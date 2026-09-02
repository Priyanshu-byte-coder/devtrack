import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("devtrack_projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ projects: data || [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const { name, key, description, enable_keyword_triggers } = await req.json();

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Project key is required" }, { status: 400 });
    }

    const cleanKey = key.trim().toUpperCase();
    const keyRegex = /^[A-Z][A-Z0-9]{1,9}$/;
    if (!keyRegex.test(cleanKey)) {
      return NextResponse.json(
        { error: "Project key must be 2-10 alphanumeric characters starting with a letter" },
        { status: 400 }
      );
    }

    // Insert project
    const { data, error } = await supabaseAdmin
      .from("devtrack_projects")
      .insert({
        user_id: user.id,
        name: name.trim(),
        key: cleanKey,
        description: (description || "").trim(),
        enable_keyword_triggers: enable_keyword_triggers !== false,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") { // Unique violation
        return NextResponse.json(
          { error: "A project with this key already exists." },
          { status: 409 }
        );
      }
      console.error("Failed to create project:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Error creating project:", err);
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
