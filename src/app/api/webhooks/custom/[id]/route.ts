import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser, AppUser } from "@/lib/resolve-user";
import { isSafeUrl } from "@/lib/ssrf-protection";

export const dynamic = "force-dynamic";

interface WebhookUpdateInput {
  name?: string;
  url?: string;
  events?: string[];
  is_enabled?: boolean;
}

async function requireUser(): Promise<{ user: AppUser } | { error: Response }> {
  const session = await getServerSession(authOptions);

  if (!session?.githubId || !session?.githubLogin) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userRow = await resolveAppUser(session.githubId, session.githubLogin);

  if (!userRow) {
    return { error: Response.json({ error: "User not found" }, { status: 404 }) };
  }

  return { user: userRow };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  const { id } = await params;

  const { data: webhook } = await supabaseAdmin
    .from("webhook_configs")
    .select("id, name, url, events, is_enabled, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", result.user.id)
    .single();

  if (!webhook) {
    return Response.json({ error: "Webhook not found" }, { status: 404 });
  }

  const { data: recentDeliveries } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id, event, status_code, success, error_message, delivered_at, payload")
    .eq("webhook_id", id)
    .order("delivered_at", { ascending: false })
    .limit(20);

  return Response.json({
    webhook,
    recentDeliveries: recentDeliveries || [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  const { id } = await params;

  let body: WebhookUpdateInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("webhook_configs")
    .select("id")
    .eq("id", id)
    .eq("user_id", result.user.id)
    .single();

  if (!existing) {
    return Response.json({ error: "Webhook not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) {
    if (!body.name.trim()) {
      return Response.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    updateData.name = body.name.trim();
  }

  if (body.url !== undefined) {
    try {
      const parsed = new URL(body.url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return Response.json(
          { error: "URL must use HTTP or HTTPS protocol" },
          { status: 400 }
        );
      }
      const safe = await isSafeUrl(body.url);
      if (!safe) {
        return Response.json(
          { error: "Webhook URL is not allowed. Private, loopback, and internal addresses are blocked." },
          { status: 400 }
        );
      }
      updateData.url = body.url;
    } catch {
      return Response.json({ error: "Invalid URL format" }, { status: 400 });
    }
  }

  if (body.events !== undefined) {
    if (!Array.isArray(body.events) || body.events.length === 0) {
      return Response.json(
        { error: "At least one event must be selected" },
        { status: 400 }
      );
    }
    const validEvents = [
      "goal.completed",
      "goal.created",
      "streak.milestone",
      "daily.summary",
      "weekly.summary",
      "metrics.updated",
    ];
    const invalidEvents = body.events.filter((e) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return Response.json(
        { error: `Invalid events: ${invalidEvents.join(", ")}` },
        { status: 400 }
      );
    }
    updateData.events = body.events;
  }

  if (body.is_enabled !== undefined) {
    updateData.is_enabled = body.is_enabled;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("webhook_configs")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", result.user.id)
    .select("id, name, url, events, is_enabled, created_at, updated_at")
    .single();

  if (error) {
    console.error("Error updating webhook:", error);
    return Response.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    );
  }

  return Response.json({ webhook: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("webhook_configs")
    .delete()
    .eq("id", id)
    .eq("user_id", result.user.id);

  if (error) {
    console.error("Error deleting webhook:", error);
    return Response.json(
      { error: "Failed to delete webhook" },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
