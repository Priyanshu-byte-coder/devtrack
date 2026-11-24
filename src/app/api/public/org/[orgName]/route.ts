import { NextRequest, NextResponse } from "next/server";
import { fetchOrgAnalytics } from "@/lib/org-analytics";
import { createMemoryFixedWindowRateLimiter, getClientIp } from "@/lib/rate-limit";
import { getUpstashConfig, upstashRateLimitFixedWindow } from "@/lib/upstash-rest";
import { githubRateLimitResponse } from "@/lib/github-rate-limit";

export const dynamic = "force-dynamic";

/**
 * GitHub organization names: 1–39 chars, alphanumeric or single hyphens,
 * cannot start or end with a hyphen.
 */
const GITHUB_ORG_NAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

const RATE_LIMIT_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MEMORY_MAX_ENTRIES = Number(process.env.MEMORY_RATE_LIMIT_MAX_ENTRIES ?? 10_000);
const memoryLimiter = createMemoryFixedWindowRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  pruneIntervalMs: 5 * 60 * 1000,
  maxEntries: Number.isFinite(MEMORY_MAX_ENTRIES) ? MEMORY_MAX_ENTRIES : 10_000,
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgName: string }> }
): Promise<Response> {
  const { orgName } = await params;

  if (!GITHUB_ORG_NAME_RE.test(orgName)) {
    return NextResponse.json({ error: "Invalid organization name" }, { status: 400 });
  }

  // Rate limiting
  const ip = getClientIp(req);
  const rateLimit = getUpstashConfig()
    ? await upstashRateLimitFixedWindow({
        key: `org-analytics-rate-limit:${ip}`,
        limit: RATE_LIMIT_REQUESTS,
        windowSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      })
    : (() => {
        const local = memoryLimiter.check(`org-analytics-rate-limit:${ip}`, RATE_LIMIT_REQUESTS);
        return local.allowed
          ? { allowed: true }
          : {
              allowed: false,
              retryAfter: Math.max(local.reset - Math.floor(Date.now() / 1000), 1),
            };
      })();

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      }
    );
  }

  try {
    const data = await fetchOrgAnalytics(orgName);
    if (!data) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    const cooldown = githubRateLimitResponse(error);
    if (cooldown) return cooldown;
    return NextResponse.json(
      { error: "Organization analytics temporarily unavailable" },
      { status: 503 }
    );
  }
}
