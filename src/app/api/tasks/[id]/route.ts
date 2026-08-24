import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { stripHtml } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUser = await resolveAppUser(session.githubId, session.githubLogin);
  if (!appUser) return new Response("User not found", { status: 404 });

  try {
    const body = await req.json();
    
    const updates: any = {};
    if (body.title !== undefined) {
      updates.title = stripHtml(body.title).trim();
      if (!updates.title) return new Response("Title cannot be empty", { status: 400 });
    }
    if (body.completed !== undefined) {
      updates.completed = Boolean(body.completed);
    }
    if (body.status !== undefined) {
      updates.status = stripHtml(body.status).trim();
    }
    if (body.priority !== undefined) {
      updates.priority = stripHtml(body.priority).trim();
    }
    if (body.dueDate !== undefined) {
      updates.due_date = body.dueDate;
    }
    if (body.tags !== undefined && Array.isArray(body.tags)) {
      updates.tags = body.tags.map((t: string) => stripHtml(t).trim());
    }
    if (body.milestoneId !== undefined) {
      updates.milestone_id = body.milestoneId;
    }
    if (body.recurrence_config !== undefined) {
      updates.recurrence_config = body.recurrence_config;
    }

    updates.updated_at = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", id)
      .eq("user_id", appUser.id)
      .single();

    if (!existing) {
      return new Response("Task not found", { status: 404 });
    }

    const isBeingCompleted = (updates.completed === true || updates.status === 'done') && 
                             (existing.completed === false && existing.status !== 'done');
    
    // Auto-create recurrence if applicable
    if (isBeingCompleted && existing.recurrence_config) {
      const config = existing.recurrence_config;
      const count = existing.recurrence_count || 0;
      
      if (!config.endsAfter || count < config.endsAfter) {
        let nextDueDate = existing.due_date ? new Date(existing.due_date) : new Date();
        
        if (config.type === 'daily') {
          nextDueDate.setDate(nextDueDate.getDate() + 1);
        } else if (config.type === 'weekly') {
          nextDueDate.setDate(nextDueDate.getDate() + 7);
        } else if (config.type === 'monthly') {
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        } else if (config.type === 'custom' && config.intervalDays) {
          nextDueDate.setDate(nextDueDate.getDate() + config.intervalDays);
        }

        // Insert new task
        await supabaseAdmin.from("tasks").insert({
          user_id: appUser.id,
          title: existing.title,
          milestone_id: existing.milestone_id,
          completed: false,
          status: 'todo',
          priority: existing.priority,
          due_date: nextDueDate.toISOString(),
          tags: existing.tags,
          recurrence_config: config,
          recurrence_count: count + 1
        });
        
        // Remove recurrence config from this completed task so it doesn't trigger again
        updates.recurrence_config = null;
      }
    }

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .eq("user_id", appUser.id)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(task), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUser = await resolveAppUser(session.githubId, session.githubLogin);
  if (!appUser) return new Response("User not found", { status: 404 });

  const { error } = await supabaseAdmin
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", appUser.id);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
