import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";

// Returns "YYYY-MM-DD" for "now", computed in the given IANA timezone
// (not UTC). This must match the timezone-bucketing logic used in
// /api/metrics/streak, otherwise a freeze can land on a different
// calendar day than the streak calculator expects (issue #2952).
function todayStr(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

// Fetches the user's stored timezone (Supabase `users.timezone`), falling
// back to UTC if unset. Wrapped in try/catch because Intl.DateTimeFormat
// throws on an invalid/garbage IANA timezone string, and we'd rather
// degrade to UTC than 500 the request.
async function getUserTimeZone(userId: string): Promise<string> {
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("timezone")
    .eq("id", userId)
    .single();

  const timeZone = userRow?.timezone || "UTC";

  try {
    // Cheap validity check: throws RangeError on bad IANA names.
    new Intl.DateTimeFormat("en", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

// GET /api/streak/freeze
// Returns whether the user currently has an unused freeze available.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const timeZone = await getUserTimeZone(user.id);

  // timeZone is included in the cache key so users in different timezones
  // (or a user whose timezone setting changes) don't read a stale
  // "hasFreeze" computed against the wrong calendar day.
  const cacheKey = metricsCacheKey(user.id, "streak_freeze", { timeZone });
  const bypass = isMetricsCacheBypassed(req);

  const status = await withMetricsCache(
    {
      bypass,
      key: cacheKey,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS.streak,
    },
    async () => getFreezeStatus(user.id, timeZone)
  );

  return Response.json(status);
}

async function getFreezeStatus(userId: string, timeZone: string) {
  const today = todayStr(timeZone);

  const { data: pending } = await supabaseAdmin
    .from("streak_freezes")
    .select("id, freeze_date")
    .eq("user_id", userId)
    .gte("freeze_date", today)
    .limit(1);

  const hasFreeze = Array.isArray(pending) && pending.length > 0;

  return { hasFreeze, freezeDate: hasFreeze ? pending![0].freeze_date : null };
}

// POST /api/streak/freeze
// Inserts a freeze for today (in the user's local timezone). Fails if the
// user already holds an unused freeze.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const timeZone = await getUserTimeZone(user.id);
  const today = todayStr(timeZone);

  // Prevent users from stockpiling unused freezes
  const { count } = await supabaseAdmin
    .from("streak_freezes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("freeze_date", today);

  const MAX_PENDING_FREEZES = 1;

  if (count !== null && count >= MAX_PENDING_FREEZES) {
    return Response.json(
      { error: "You already have a pending freeze." },
      { status: 409 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("streak_freezes")
    .select("id")
    .eq("user_id", user.id)
    .eq("freeze_date", today)
    .maybeSingle();

  const { data: freeze, error } = await supabaseAdmin
    .from("streak_freezes")
    .upsert(
      { user_id: user.id, freeze_date: today },
      { onConflict: "user_id,freeze_date" }
    )
    .select()
    .single();

  if (error) {
    return Response.json({ error: "Failed to apply freeze." }, { status: 500 });
  }

  const alreadyExisted = existing !== null;
  const statusCode = alreadyExisted ? 200 : 201;

  return Response.json(
    { freeze, already_existed: alreadyExisted },
    { status: statusCode }
  );
}

// DELETE /api/streak/freeze
// Removes today's (local-timezone) active freeze for the authenticated user.
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const timeZone = await getUserTimeZone(user.id);

  const { error } = await supabaseAdmin
    .from("streak_freezes")
    .delete()
    .eq("user_id", user.id)
    .eq("freeze_date", todayStr(timeZone));

  if (error)
    return Response.json({ error: "Failed to cancel freeze" }, { status: 500 });

  return Response.json({ success: true });
}