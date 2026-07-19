import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser, AppUser } from "@/lib/resolve-user";
import { generateSecretKey, encryptSecretKey } from "@/lib/webhooks";
import { isSafeUrl } from "@/lib/ssrf-protection";
import { validateTextInput } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const MAX_WEBHOOKS_PER_USER = 5;

interface WebhookInput {
  name: string;
  url: string;
  events: string[];
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

export async function GET(req: NextRequest) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  const { data: webhooks, error } = await supabaseAdmin
    .from("webhook_configs")
    .select("id, name, url, events, is_enabled, created_at, updated_at")
    .eq("user_id", result.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch webhooks:", error);
    return Response.json(
      { error: "Failed to fetch webhooks" },
      { status: 500 }
    );
  }

  return Response.json({ webhooks: webhooks ?? [] });
}

export async function POST(req: NextRequest) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  let body: WebhookInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, url, events } = body;

  const validatedName = validateTextInput(name, "Webhook name", 100);

  if (!validatedName.ok) {
    return Response.json(
      { error: validatedName.error },
      { status: 400 }
    );
  }

  if (!url) {
    return Response.json(
      { error: "Invalid webhook URL. Must be a valid HTTP/HTTPS URL." },
      { status: 400 }
    );
  }

  const safe = await isSafeUrl(url);
  if (!safe) {
    return Response.json(
      { error: "Webhook URL is not allowed. Private, loopback, and internal addresses are blocked." },
      { status: 400 }
    );
  }

  if (!events || !Array.isArray(events) || events.length === 0) {
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

  const invalidEvents = events.filter((e) => !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    return Response.json(
      { error: `Invalid events: ${invalidEvents.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: existingWebhooks } = await supabaseAdmin
    .from("webhook_configs")
    .select("id")
    .eq("user_id", result.user.id);

  if (existingWebhooks && existingWebhooks.length >= MAX_WEBHOOKS_PER_USER) {
    return Response.json(
      { error: `Webhook limit reached. Maximum ${MAX_WEBHOOKS_PER_USER} webhooks per user.` },
      { status: 400 }
    );
  }

  const secretKey = generateSecretKey();
  const { encrypted, iv } = encryptSecretKey(secretKey);

  const { data: webhook, error } = await supabaseAdmin
    .from("webhook_configs")
    .insert({
      user_id: result.user.id,
      name: validatedName.value,
      url,
      events,
      secret_key: encrypted,
      secret_iv: iv,
      is_enabled: true,
    })
    .select("id, name, url, events, is_enabled, created_at")
    .single();

  if (error) {
    console.error("Error creating webhook:", error);
    return Response.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }

  return Response.json({
    webhook,
    secretKey,
    message: "Store this secret key securely. It will not be shown again.",
  });
}
