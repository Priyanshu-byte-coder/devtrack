import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveAppUser } from "@/lib/resolve-user";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUser = await resolveAppUser(session.githubId, session.githubLogin);
  if (!appUser) return new Response("User not found", { status: 404 });

  try {
    const { updates } = await req.json();
    if (!Array.isArray(updates) || updates.length === 0) {
      return new Response("Invalid updates payload", { status: 400 });
    }

    // Process updates concurrently or in batch.
    // Supabase JS doesn't have a single bulk update method, so we run multiple updates.
    const promises = updates.map(async (update: any) => {
      const { id, order_index, status } = update;
      const dataToUpdate: any = { order_index };
      if (status !== undefined) {
        dataToUpdate.status = status;
        dataToUpdate.completed = status === 'done';
      }

      return supabaseAdmin
        .from("tasks")
        .update(dataToUpdate)
        .eq("id", id)
        .eq("user_id", appUser.id);
    });

    await Promise.all(promises);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}
