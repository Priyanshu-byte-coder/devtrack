import { getSessionWithToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const GITHUB_API = "https://api.github.com";
const MAX_RESULTS = 6;

export async function GET(req: NextRequest) {
  const sessionData = await getSessionWithToken();
  if (!sessionData) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = sessionData.accessToken;

  const qRaw = req.nextUrl.searchParams.get("q") ?? "";
  const q = qRaw.trim();

  if (q.length < 2) {
    return Response.json({ users: [] });
  }

  if (q.length > 39) {
    return Response.json({ users: [] });
  }

  const searchRes = await fetch(
    `${GITHUB_API}/search/users?q=${encodeURIComponent(`${q} in:login`)}&per_page=${MAX_RESULTS}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!searchRes.ok) {
    return Response.json({ users: [] });
  }

  const data = (await searchRes.json()) as { items?: Array<{ login: string; avatar_url: string }> };
  const users = (data.items ?? []).map((u) => ({
    username: u.login,
    avatarUrl: u.avatar_url,
  }));

  return Response.json({ users });
}