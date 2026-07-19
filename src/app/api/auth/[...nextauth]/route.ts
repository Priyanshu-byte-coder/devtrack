import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const handler = NextAuth(authOptions);

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

type AuthRouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

export async function GET(req: NextRequest, ctx: AuthRouteContext) {
  const params = await ctx.params;
  return handler(req, { params });
}

export async function POST(req: NextRequest, ctx: AuthRouteContext) {
  const params = await ctx.params;
  const action = params.nextauth?.[0];

  const shouldRateLimit = action === "signin" || action === "callback";

  if (shouldRateLimit) {
    const ip = getClientIP(req);

    if (isRateLimited(ip)) {
      return NextResponse.redirect(
        new URL("/auth/signin?error=RateLimitError", req.url),
        { status: 303 }
      );
    }
  }

  return handler(req, { params });
}
