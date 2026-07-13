import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("github_id", session.githubId)
    .single();

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Only delete if the task belongs to the authenticated user. Associated
  // time_entries are removed via the ON DELETE CASCADE foreign key.
  const { error } = await supabaseAdmin
    .from("tasks")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: "Failed to delete task" }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 200 });
}
