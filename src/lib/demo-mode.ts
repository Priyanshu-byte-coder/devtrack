import fs from "node:fs";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

// Offline showcase mode: replays API responses recorded by
// scripts/demo/record.mjs so the app runs with zero GitHub/Supabase calls.
export const isDemoMode = process.env.DEMO_MODE === "true";

type Fixture = { status: number; contentType: string; body: string };
type DemoUser = {
  githubId: string;
  githubLogin: string;
  name: string;
  image: string;
};
type FixtureFile = { user?: DemoUser; responses: Record<string, Fixture> };

let cached: FixtureFile | null = null;

function readFixtureFile(file: string): FixtureFile {
  return fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf8")) as FixtureFile)
    : { responses: {} };
}

// Committed seed data covers features with no recordable data; recorded
// responses (private, gitignored) take precedence.
function fixtures(): FixtureFile {
  if (!cached) {
    const recordedFile =
      process.env.DEMO_FIXTURES ??
      path.join(process.cwd(), "demo", "fixtures.json");
    const seed = readFixtureFile(
      path.join(path.dirname(recordedFile), "seed-fixtures.json")
    );
    const recorded = readFixtureFile(recordedFile);
    cached = {
      user: recorded.user,
      responses: { ...seed.responses, ...recorded.responses },
    };
  }
  return cached;
}

function respond(f: Fixture) {
  return new NextResponse(f.body, {
    status: f.status,
    headers: { "Content-Type": f.contentType, "Cache-Control": "no-store" },
  });
}

export async function handleDemoRequest(
  req: NextRequest
): Promise<NextResponse | null> {
  const { pathname, search } = req.nextUrl;

  if (pathname === "/demo") {
    const user = fixtures().user;
    if (!user)
      return NextResponse.json(
        { error: "No demo user recorded" },
        { status: 500 }
      );
    const token = await encode({
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 7 * 24 * 3600,
      token: {
        sub: user.githubId,
        name: user.name,
        picture: user.image,
        githubId: user.githubId,
        githubLogin: user.githubLogin,
      },
    });
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    const res = NextResponse.redirect(url);
    res.cookies.set({
      name: "next-auth.session-token",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });
    return res;
  }

  // NextAuth's own handlers decode the session cookie locally; let them run.
  if (!pathname.startsWith("/api/") || pathname.startsWith("/api/auth/"))
    return null;

  if (req.method !== "GET" && req.method !== "HEAD") {
    return NextResponse.json({ ok: true, demo: true });
  }

  const { responses } = fixtures();
  const hit = responses[`${pathname}${search}`] ?? responses[pathname];
  if (hit) return respond(hit);

  if (pathname === "/api/stream") {
    return new NextResponse("retry: 600000\ndata: {}\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  return NextResponse.json(
    { error: "Not recorded in demo mode" },
    { status: 404 }
  );
}
