import type { MetadataRoute } from "next";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import { GUIDES } from "@/content/guides";
import { TOP_COUNTRIES, TOP_LANGUAGES } from "@/lib/top-developers";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://devtrack.live";

// Rebuilt hourly so newly public profiles get discovered without a deploy.
export const revalidate = 3600;

// A single sitemap file is capped at 50,000 URLs.
const MAX_PROFILES = 45_000;

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: BASE_URL, changeFrequency: "daily", priority: 1 },
  { url: `${BASE_URL}/leaderboard`, changeFrequency: "daily", priority: 0.9 },
  { url: `${BASE_URL}/compare`, changeFrequency: "weekly", priority: 0.7 },
  { url: `${BASE_URL}/sponsor`, changeFrequency: "monthly", priority: 0.4 },
  { url: `${BASE_URL}/top`, changeFrequency: "weekly", priority: 0.7 },
  ...TOP_LANGUAGES.map((l) => ({
    url: `${BASE_URL}/top/${l.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.6,
  })),
  ...TOP_COUNTRIES.map((c) => ({
    url: `${BASE_URL}/top/country/${c.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.6,
  })),
  { url: `${BASE_URL}/guides`, changeFrequency: "weekly", priority: 0.6 },
  ...GUIDES.map((g) => ({
    url: `${BASE_URL}/guides/${g.slug}`,
    lastModified: new Date(g.updated),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  })),
  { url: `${BASE_URL}/wrapped`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${BASE_URL}/guidelines`, changeFrequency: "yearly", priority: 0.3 },
  {
    url: `${BASE_URL}/privacy-policy`,
    changeFrequency: "yearly",
    priority: 0.2,
  },
  { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  { url: `${BASE_URL}/contact`, changeFrequency: "yearly", priority: 0.2 },
];

async function publicProfileRoutes(): Promise<MetadataRoute.Sitemap> {
  if (!isSupabaseAdminAvailable) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("github_login, updated_at")
      .eq("is_public", true)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(MAX_PROFILES);

    if (error || !data) return [];

    return data
      .filter((row) => typeof row.github_login === "string" && row.github_login)
      .map((row) => ({
        // Profiles canonicalise to lowercase; list that form so crawlers skip the redirect.
        url: `${BASE_URL}/u/${encodeURIComponent(row.github_login.toLowerCase())}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
        changeFrequency: "daily" as const,
        priority: 0.7,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [...STATIC_ROUTES, ...(await publicProfileRoutes())];
}
