import sys

filepath = "src/app/api/tasks/[id]/route.ts"
with open(filepath, "r") as f:
    content = f.read()

# We need to find the PUT function and replace its logic.
# The PUT function starts with `export async function PUT`

old_put = """export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUser = await resolveAppUser(session.githubId, session.githubLogin);
  if (!appUser) {
    return new Response("User not found", { status: 404 });
  }

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

    if (Object.keys(updates).length === 0) {
      return new Response("No updates provided", { status: 400 });
    }

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .update(updates)
      .eq("id", params.id)
      .eq("user_id", appUser.id)
      .select()
      .single();

    if (error) throw error;
    if (!task) return new Response("Task not found", { status: 404 });

    return new Response(JSON.stringify(task), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}"""

new_put = """export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUser = await resolveAppUser(session.githubId, session.githubLogin);
  if (!appUser) {
    return new Response("User not found", { status: 404 });
  }

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

    if (Object.keys(updates).length === 0) {
      return new Response("No updates provided", { status: 400 });
    }

    // Fetch the task first to check recurrence logic
    const { data: existingTask, error: fetchError } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", appUser.id)
      .single();

    if (fetchError || !existingTask) {
      return new Response("Task not found", { status: 404 });
    }

    const isBeingCompleted = (updates.completed === true || updates.status === 'done') && 
                             (existingTask.completed === false && existingTask.status !== 'done');
    
    // Auto-create recurrence if applicable
    if (isBeingCompleted && existingTask.recurrence_config) {
      const config = existingTask.recurrence_config;
      const count = existingTask.recurrence_count || 0;
      
      if (!config.endsAfter || count < config.endsAfter) {
        let nextDueDate = existingTask.due_date ? new Date(existingTask.due_date) : new Date();
        
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
          title: existingTask.title,
          milestone_id: existingTask.milestone_id,
          completed: false,
          status: 'todo',
          priority: existingTask.priority,
          due_date: nextDueDate.toISOString(),
          tags: existingTask.tags,
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
      .eq("id", params.id)
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
}"""

if old_put in content:
    content = content.replace(old_put, new_put)
    with open(filepath, "w") as f:
        f.write(content)
    print("Updated src/app/api/tasks/[id]/route.ts successfully")
else:
    print("Could not find the target text in src/app/api/tasks/[id]/route.ts")
