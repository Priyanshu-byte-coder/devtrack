import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser, AppUser } from "@/lib/resolve-user";
import { decryptSecretKey, signPayload } from "@/lib/webhooks";
import { pinnedFetch } from "@/lib/pinned-fetch";

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
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  const { id } = await params;

  const { data: webhook } = await supabaseAdmin
    .from("webhook_configs")
    .select("id, url, secret_key, secret_iv")
    .eq("id", id)
    .eq("user_id", result.user.id)
    .single();

  if (!webhook) {
    return Response.json({ error: "Webhook not found" }, { status: 404 });
  }

  const secret = decryptSecretKey(webhook.secret_key, webhook.secret_iv);
  if (!secret) {
    return Response.json({ error: "Failed to decrypt webhook secret" }, { status: 500 });
  }

 const testPayload = {
  event: "test",
  timestamp: new Date().toISOString(),
  data: {
    message: "This is a test webhook delivery from DevTrack",
    webhookId: webhook.id,
    userId: result.user.id,
    test: true,
  },
};

const payloadString = JSON.stringify(testPayload);
const signature = signPayload(payloadString, secret);

const result2 = await pinnedFetch(webhook.url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Webhook-Signature": `sha256=${signature}`,
    "X-Webhook-Event": "test",
    "X-Webhook-Delivery-Id": webhook.id,
  },
  body: payloadString,
  timeoutMs: 15000,
});

const statusCode = result2.status;
const success = result2.ok;
const errorMessage = result2.error;
const responseBody = result2.body;

await supabaseAdmin.from("webhook_deliveries").insert({
  webhook_id: id,
  event: "test",
  payload: testPayload,
  status_code: statusCode,
  success,
  error_message: success ? null : (errorMessage ?? `HTTP ${statusCode}`),
});

  return Response.json({
    success,
    statusCode,
    error: errorMessage,
    responseBody,
    message: success
      ? "Test webhook delivered successfully"
      : "Test webhook delivery failed",
  });
}
