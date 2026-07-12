import { createHmac, randomBytes } from "crypto";
import { supabaseAdmin } from "./supabase";
import { encryptToken, decryptToken } from "./crypto";
import { pinnedFetch } from "./pinned-fetch";  // ← naya import

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

const WEBHOOK_EVENTS = [
  "goal.completed",
  "goal.created",
  "streak.milestone",
  "daily.summary",
  "weekly.summary",
  "metrics.updated",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export function isValidWebhookEvent(event: string): event is WebhookEvent {
  return WEBHOOK_EVENTS.includes(event as WebhookEvent);
}

export function getAvailableEvents(): readonly string[] {
  return WEBHOOK_EVENTS;
}

export function generateSecretKey(): string {
  return randomBytes(32).toString("hex");
}

export function encryptSecretKey(secret: string): { encrypted: string; iv: string } {
  return encryptToken(secret);
}

export function decryptSecretKey(encrypted: string, iv: string): string | null {
  return decryptToken(encrypted, iv);
}

export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function dispatchWebhook(
  webhookId: string,
  event: string,
  data: Record<string, unknown>
): Promise<WebhookDeliveryResult> {
  const { data: webhook, error } = await supabaseAdmin
    .from("webhook_configs")
    .select("*")
    .eq("id", webhookId)
    .eq("is_enabled", true)
    .single();

  if (error || !webhook) {
    return { success: false, error: "Webhook not found or disabled" };
  }

  const secret = decryptSecretKey(webhook.secret_key, webhook.secret_iv);
  if (!secret) {
    return { success: false, error: "Failed to decrypt webhook secret" };
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString, secret);

  // ✅ FIX: pinnedFetch ek hi baar DNS resolve karta hai aur us pinned IP
  // pe directly connect karta hai — TOCTOU gap khatam
  const result = await pinnedFetch(webhook.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Signature": `sha256=${signature}`,
      "X-Webhook-Event": event,
      "X-Webhook-Delivery-Id": webhookId,
    },
    body: payloadString,
    timeoutMs: 10000,
  });

  // SSRF block ya network failure — koi HTTP request gayi hi nahi
  if (!result.status) {
    await supabaseAdmin.from("webhook_deliveries").insert({
      webhook_id: webhookId,
      event,
      payload,
      success: false,
      error_message: result.error,
    });
    return { success: false, error: result.error };
  }

  const statusCode = result.status;
  const success = result.ok;

  await supabaseAdmin.from("webhook_deliveries").insert({
    webhook_id: webhookId,
    event,
    payload,
    status_code: statusCode,
    success,
    error_message: success ? null : `HTTP ${statusCode}`,
  });

  return { success, statusCode };
}

export async function dispatchToAllWebhooks(
  userId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const MAX_WEBHOOKS_PER_USER = 5;

  const { data: webhooks } = await supabaseAdmin
    .from("webhook_configs")
    .select("id")
    .eq("user_id", userId)
    .eq("is_enabled", true)
    .contains("events", [event])
    .limit(MAX_WEBHOOKS_PER_USER);

  if (!webhooks) return;

  await Promise.all(
    webhooks.map((webhook) => dispatchWebhook(webhook.id, event, data))
  );
}