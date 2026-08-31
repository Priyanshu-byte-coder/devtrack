import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createHash } from "crypto";
import { getUpstashConfig, upstashRateLimitFixedWindow } from "@/lib/upstash-rest";


export const dynamic = "force-dynamic";

const MAX_SESSIONS_PER_REQUEST = 100;
const MAX_SESSIONS_PER_USER = 365;
const ALLOWED_DAYS = [7, 30, 90];
const DEFAULT_DAYS = 30;

const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

type MemoryRateEntry = { count: number; resetAt: number };
const memoryRateLimits = new Map<string, MemoryRateEntry>();


// lgtm[js/insufficient-password-hash] - SHA-256 is appropriate for hashing high-entropy random API keys, not passwords
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function authenticateApiKey(apiKey: string): Promise<string | null> {
  const keyHash = hashApiKey(apiKey);

  const { data: keyRecord } = await supabaseAdmin
    .from("local_coding_api_keys")
    .select("user_id")
    .eq("api_key_hash", keyHash)
    .single();

  if (keyRecord) {
    await supabaseAdmin
      .from("local_coding_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("api_key_hash", keyHash);

    return keyRecord.user_id;
  }

  // Attempt Legacy Fallback (If Step 2 fails)
  const { data: legacyRecord } = await supabaseAdmin
    .from("local_coding_api_keys")
    .select("id, user_id")
    .eq("api_key", apiKey)
    .single();

  if (legacyRecord) {
    // Execute the Silent Upgrade (non-blocking)
    (async () => {
      try {
        const { error } = await supabaseAdmin
          .from("local_coding_api_keys")
          .update({
            api_key_hash: keyHash,
            api_key: null,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", legacyRecord.id);

        if (error) {
          console.error("Failed to silently upgrade legacy API key:", error);
        }
      } catch (err) {
        console.error("Unhandled error during legacy API key silent upgrade:", err);
      }
    })();

    return legacyRecord.user_id;
  }

  return null;
}

function validateDays(days: number): number {
  if (ALLOWED_DAYS.includes(days)) {
    return days;
  }
  return DEFAULT_DAYS;
}

function getMemoryRateLimitKey(apiKeyHash: string): string {
  return `local-coding-sync-rate-limit:${apiKeyHash}`;
}

function checkMemoryRateLimit(
  key: string
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = memoryRateLimits.get(key);

  if (!record || now > record.resetAt) {
    memoryRateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count < RATE_LIMIT_REQUESTS) {
    record.count += 1;
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfter: Math.ceil((record.resetAt - now) / 1000),
  };
}

async function checkRateLimit(
  key: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const upstash = getUpstashConfig();
  if (upstash) {
    return upstashRateLimitFixedWindow({
      key,
      limit: RATE_LIMIT_REQUESTS,
      windowSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  }

  return checkMemoryRateLimit(key);
}

interface SessionData {

  date: string;
  totalSeconds: number;
  fileCount: number;
  projectCount: number;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Response.json({ error: "API key required" }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const apiKeyHash = hashApiKey(apiKey);
  const userId = await authenticateApiKey(apiKey);

  if (!userId) {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }

  const rateLimitKey = getMemoryRateLimitKey(apiKeyHash);
  const rateLimit = await checkRateLimit(rateLimitKey);

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) },
      }
    );
  }

  let body: { sessions?: SessionData[] };

  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessions = body.sessions;
  if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
    return Response.json(
      { error: "Sessions array is required" },
      { status: 400 }
    );
  }

  if (sessions.length > MAX_SESSIONS_PER_REQUEST) {
    return Response.json(
      { error: `Too many sessions. Maximum ${MAX_SESSIONS_PER_REQUEST} per request.` },
      { status: 400 }
    );
  }

  const { count: existingCount } = await supabaseAdmin
    .from("local_coding_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const newSessions = sessions.filter((s) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(s.date)) {
      return false;
    }
    if (typeof s.totalSeconds !== "number" || s.totalSeconds < 0) {
      return false;
    }
    return true;
  });

  if (newSessions.length !== sessions.length) {
    return Response.json(
      { error: "Invalid session data found in array" },
      { status: 400 }
    );
  }

  const incomingDates = [...new Set(newSessions.map((session) => session.date))];
  const { data: existingSessionsForDates } = await supabaseAdmin
    .from("local_coding_sessions")
    .select("date")
    .eq("user_id", userId)
    .in("date", incomingDates);

  const existingDateSet = new Set(
    (existingSessionsForDates ?? []).map((session: { date: string }) => session.date)
  );
  const newDateCount = incomingDates.filter((date) => !existingDateSet.has(date)).length;

  if ((existingCount || 0) + newDateCount > MAX_SESSIONS_PER_USER) {
    return Response.json(
      { error: `Session limit reached. Maximum ${MAX_SESSIONS_PER_USER} sessions per user.` },
      { status: 400 }
    );
  }

  const records = newSessions.map((session) => ({
    user_id: userId,
    date: session.date,
    total_seconds: session.totalSeconds,
    file_count: session.fileCount || 0,
    project_count: session.projectCount || 0,
  }));

  const { count: latestCount } = await supabaseAdmin
    .from("local_coding_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  
  if ((latestCount || 0) + newDateCount > MAX_SESSIONS_PER_USER) {
    return Response.json(
      {
        error: `Session limit reached. Maximum ${MAX_SESSIONS_PER_USER} sessions per user.`,
      },
      { status: 400 }
    );
  }


  const { error: upsertError } = await supabaseAdmin.rpc("batch_upsert_sessions", {
    sessions: records,
  });

  if (upsertError) {
    console.error("Failed to sync sessions via RPC:", upsertError);
    return Response.json({ error: "Failed to sync sessions" }, { status: 500 });
  }

  return Response.json({
    success: true,
    synced: records.length,
    message: "Sessions synced successfully",
  });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Response.json({ error: "API key required" }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const userId = await authenticateApiKey(apiKey);

  if (!userId) {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawDays = parseInt(searchParams.get("days") || "30", 10);
  const days = validateDays(isNaN(rawDays) ? DEFAULT_DAYS : rawDays);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromDateStr = fromDate.toISOString().slice(0, 10);

  const { data: sessions, error } = await supabaseAdmin
    .from("local_coding_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("date", fromDateStr)
    .order("date", { ascending: false });

  if (error) {
    console.error("Failed to fetch local coding sessions:", error);
    return Response.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }

  return Response.json({ sessions: sessions ?? [] });
}
