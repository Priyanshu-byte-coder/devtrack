type UpstashConfig = { url: string; token: string };

export function getUpstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return { url, token };
}

export async function upstashPipeline(
  commands: Array<Array<string | number>>
): Promise<Array<{ result?: unknown; error?: string }>> {
  const config = getUpstashConfig();
  if (!config) {
    return [];
  }

  const res = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  return (await res.json()) as Array<{ result?: unknown; error?: string }>;
}

export async function upstashRateLimitFixedWindow(options: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; retryAfter?: number }> {
  const results = await upstashPipeline([
    ["INCR", options.key],
    ["TTL", options.key],
  ]);

  const count = Number(results[0]?.result ?? NaN);
  const ttl = Number(results[1]?.result ?? NaN);

  if (!Number.isFinite(count)) {
    return { allowed: true };
  }

  // ttl values: -2 (no key), -1 (no expiry), or >= 0
  if (!Number.isFinite(ttl) || ttl < 0) {
    // Best-effort: ensure the key expires to avoid leaks.
    await upstashPipeline([["EXPIRE", options.key, options.windowSeconds]]);
    if (count > options.limit) {
      return { allowed: false, retryAfter: options.windowSeconds };
    }
    return { allowed: true };
  }

  if (count === 1) {
    await upstashPipeline([["EXPIRE", options.key, options.windowSeconds]]);
  }

  if (count > options.limit) {
    return { allowed: false, retryAfter: Math.max(ttl, 1) };
  }

  return { allowed: true };
}

export async function upstashTryAcquireLock(options: {
  key: string;
  ttlSeconds: number;
  value?: string;
}): Promise<boolean> {
  // The lock value is an ownership token — whoever holds it may release the
  // lock, so it must not be guessable from the clock. Math.random() is not.
  // Web Crypto rather than node:crypto so this stays usable from the edge runtime.
  const value = options.value ?? `${Date.now()}:${globalThis.crypto.randomUUID()}`;
  const results = await upstashPipeline([
    ["SET", options.key, value, "NX", "EX", options.ttlSeconds],
  ]);

  // Upstash returns "OK" when set, null when not set.
  return results[0]?.result === "OK";
}

