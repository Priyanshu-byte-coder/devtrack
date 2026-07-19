import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { formatActivity } from "@/lib/activity-formatter";
import type { RawEvent } from "@/lib/activity-formatter";

export const dynamic = "force-dynamic";

const GITHUB_API = "https://api.github.com";
const SITE_URL = process.env.NEXTAUTH_URL ?? "https://devtrack.dev";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildAtomFeed(
  username: string,
  items: Array<{ title: string; url: string; summary: string; published: string }>
): string {
  const feedUrl = `${SITE_URL}/u/${username}/feed.xml`;
  const profileUrl = `${SITE_URL}/u/${username}`;
  const updated = items[0]?.published ?? new Date().toISOString();

  const entries = items
    .map(
      (item) => `
  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.url)}" />
    <id>${escapeXml(item.url)}</id>
    <published>${item.published}</published>
    <updated>${item.published}</updated>
    <summary>${escapeXml(item.summary)}</summary>
  </entry>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>DevTrack activity — ${escapeXml(username)}</title>
  <link href="${escapeXml(profileUrl)}" />
  <link rel="self" href="${escapeXml(feedUrl)}" />
  <id>${escapeXml(feedUrl)}</id>
  <updated>${updated}</updated>
  <author><name>${escapeXml(username)}</name></author>
${entries}
</feed>`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const resolvedParams = await params;
  const username = resolvedParams.username;

  // Check if user has a public profile
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, github_login, is_public")
    .eq("github_login", username)
    .single();

  if (!user?.is_public) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    // Fetch public events from GitHub
    const res = await fetch(
      `${GITHUB_API}/users/${encodeURIComponent(username)}/events/public?per_page=100`,
      {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return new Response("Failed to fetch activity", { status: 502 });
    }

    const events = (await res.json()) as RawEvent[];

    const items = events
      .map(formatActivity)
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 20)
      .map((item) => ({
        title: item.title,
        url: item.url,
        summary: `${item.title} — ${item.repo}`,
        published: new Date(item.createdAt).toISOString(),
      }));

    const xml = buildAtomFeed(username, items);

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/atom+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    return new Response("Internal Server Error", { status: 500 });
  }
}