import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/server/resolveAppUser";
import genAI from "@/lib/genAI";
import crypto from "crypto";

// Optional Upstash (if available). Code falls back to an in-memory limiter/cache.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const GEMINI_KEY = process.env.GEMINI_API_KEY;

// --- Upstash / Redis init (optional) ---
let redisClient: Redis | null = null;
let upstashLimiter: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    upstashLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.fixedWindow(5, "1 h"), // 5 requests per user per hour
    });
  } catch (e) {
    // if Upstash setup fails, continue with memory fallback
    console.warn("[roast] upstash init failed, using memory fallback", e);
    redisClient = null;
    upstashLimiter = null;
  }
}

// --- Simple in-memory fallback structures ---
const memoryRate = new Map<string, { count: number; resetAt: number }>();
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

function shortHash(obj: any) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 12);
}

async function checkRate(userKey: string) {
  // Try Upstash first
  if (upstashLimiter && redisClient) {
    try {
      const res = await upstashLimiter.limit(userKey);
      if (res.success) return { ok: true };
      return { ok: false, retryAfter: Math.ceil(res.resetAfter / 1000) || 3600 };
    } catch (e) {
      console.warn("[roast] upstash limiter error, falling back to memory", e);
    }
  }

  // Memory fixed-window fallback (per-process)
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const limit = 5;
  const state = memoryRate.get(userKey);
  if (!state || state.resetAt <= now) {
    memoryRate.set(userKey, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (state.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((state.resetAt - now) / 1000) };
  }
  state.count += 1;
  memoryRate.set(userKey, state);
  return { ok: true };
}

async function getCached(key: string) {
  if (redisClient) {
    try {
      const v = await redisClient.get(key);
      if (v) return JSON.parse(v as string);
    } catch (e) {
      console.warn("[roast] redis get error", e);
    }
  } else {
    const e = memoryCache.get(key);
    if (e && e.expiresAt > Date.now()) return e.value;
    if (e) memoryCache.delete(key);
  }
  return null;
}

async function setCached(key: string, value: any, ttl = 300) {
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), { ex: ttl });
      return;
    } catch (e) {
      console.warn("[roast] redis set error", e);
    }
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
}

// Basic prompt generator (adapt to repo's existing logic if needed)
function buildPrompt(mode: string, stats: any) {
  return `Mode: ${mode}\nStats: ${JSON.stringify(stats)}\nPlease produce a short roast about the codebase.`;
}

export async function POST(req: Request) {
  // 1) require authenticated session
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) resolve app user (stable id for rate-limiting)
  const appUser = await resolveAppUser(session);
  const userId = appUser?.id ?? session.user.email ?? session.user.name ?? "unknown";

  // 3) parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const stats = body?.stats ?? {};
  const mode = body?.mode ?? "roast";

  // 4) rate limit per user
  const rateKey = `roast:ratelimit:${userId}`;
  const rl = await checkRate(rateKey);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfter: rl.retryAfter }, { status: 429 });
  }

  // 5) short response cache to avoid duplicate Gemini calls
  const cacheKey = `roast:cache:${userId}:${mode}:${shortHash(stats)}`;
  const cached = await getCached(cacheKey);
  if (cached) return NextResponse.json({ ...cached, cached: true }, { status: 200 });

  // 6) call the existing genAI pipeline (preserve existing behavior)
  try {
    const model = await genAI.getGenerativeModel(GEMINI_KEY);
    const prompt = buildPrompt(mode, stats);
    const generated = await model.generateContent(prompt);

    // store result for a short time
    await setCached(cacheKey, { result: generated }, 300);

    return NextResponse.json({ result: generated }, { status: 200 });
  } catch (err) {
    console.error("[roast] generation error", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
