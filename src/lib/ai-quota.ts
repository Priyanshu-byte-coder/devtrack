import "server-only";
import { getRedisClient } from "@/lib/metrics-cache";
import { createMemoryFixedWindowRateLimiter } from "@/lib/rate-limit";
const local = createMemoryFixedWindowRateLimiter({ windowMs: 60 * 60 * 1000 });
const script = `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return {n, redis.call('TTL', KEYS[1])}`;
export async function checkAiQuota(userId: string): Promise<Response | null> {
  const redis = getRedisClient();
  if (!redis && process.env.NODE_ENV === "production")
    return Response.json(
      { error: "AI quota storage is unavailable" },
      { status: 503 }
    );
  for (const [key, limit] of [
    [`ai:user:${userId}`, 10],
    ["ai:global", 500],
  ] as const) {
    let allowed: boolean;
    let retryAfter = 3600;
    if (redis) {
      try {
        const result = (await redis.eval(script, [key], [3600])) as [
          number,
          number,
        ];
        allowed = result[0] <= limit;
        retryAfter = Math.max(1, result[1]);
      } catch {
        return Response.json(
          { error: "AI quota storage is unavailable" },
          { status: 503 }
        );
      }
    } else {
      const result = local.check(key, limit);
      allowed = result.allowed;
      retryAfter = Math.max(1, result.reset - Math.floor(Date.now() / 1000));
    }
    if (!allowed)
      return Response.json(
        { error: "AI usage limit reached. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
  }
  return null;
}
