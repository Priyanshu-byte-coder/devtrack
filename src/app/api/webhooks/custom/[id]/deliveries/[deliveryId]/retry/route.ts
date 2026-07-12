import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser, AppUser } from "@/lib/resolve-user";
import { dispatchWebhook } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; deliveryId: string }> }
) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  const { id, deliveryId } = await params;

  const { data: webhook } = await supabaseAdmin
    .from("webhook_configs")
    .select("id, is_enabled")
    .eq("id", id)
    .eq("user_id", result.user.id)
    .single();

  if (!webhook) {
    return Response.json({ error: "Webhook not found" }, { status: 404 });
  }

  if (!webhook.is_enabled) {
    return Response.json({ error: "Webhook is disabled" }, { status: 400 });
  }

  const { data: delivery } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id, webhook_id, event, payload")
    .eq("id", deliveryId)
    .eq("webhook_id", id)
    .single();

  if (!delivery) {
    return Response.json({ error: "Delivery not found" }, { status: 404 });
  }

  const payloadData = delivery.payload as Record<string, unknown>;

  const result2 = await dispatchWebhook(id, delivery.event, payloadData);

  return Response.json({
    success: result2.success,
    statusCode: result2.statusCode,
    error: result2.error,
    message: result2.success
      ? "Webhook re-delivered successfully"
      : "Webhook re-delivery failed",
  });
}
