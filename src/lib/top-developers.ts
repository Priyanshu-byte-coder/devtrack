import "server-only";
import { unstable_cache } from "next/cache";
import { githubRequest } from "@/lib/github-request";
import { resolveServerGitHubToken } from "@/lib/github-app";

/** Languages with a "Top developers" page. Slugs are URL-safe and stable. */
export const TOP_LANGUAGES = [
  { slug: "javascript", name: "JavaScript" },
  { slug: "typescript", name: "TypeScript" },
  { slug: "python", name: "Python" },
  { slug: "java", name: "Java" },
  { slug: "go", name: "Go" },
  { slug: "rust", name: "Rust" },
  { slug: "cpp", name: "C++" },
  { slug: "c", name: "C" },
  { slug: "csharp", name: "C#" },
  { slug: "php", name: "PHP" },
  { slug: "ruby", name: "Ruby" },
  { slug: "kotlin", name: "Kotlin" },
  { slug: "swift", name: "Swift" },
  { slug: "dart", name: "Dart" },
  { slug: "scala", name: "Scala" },
  { slug: "elixir", name: "Elixir" },
  { slug: "haskell", name: "Haskell" },
  { slug: "lua", name: "Lua" },
  { slug: "zig", name: "Zig" },
  { slug: "shell", name: "Shell" },
] as const;

export type TopLanguage = (typeof TOP_LANGUAGES)[number];

export function findTopLanguage(slug: string): TopLanguage | undefined {
  return TOP_LANGUAGES.find((l) => l.slug === slug);
}

export interface TopDeveloper {
  login: string;
  name: string | null;
  followers: number;
  location: string | null;
  bio: string | null;
}

const LIMIT = 30;

/** GitHub's search qualifier value; names with symbols must be quoted. */
function languageQualifier(name: string) {
  return /^[A-Za-z]+$/.test(name) ? name : `"${name}"`;
}

const QUERY = `
query TopDevelopers($q: String!, $first: Int!) {
  search(query: $q, type: USER, first: $first) {
    nodes {
      ... on User {
        login
        name
        location
        bio
        followers { totalCount }
      }
    }
  }
}`;

async function fetchTopDevelopers(
  language: TopLanguage
): Promise<TopDeveloper[]> {
  const token = await resolveServerGitHubToken();
  if (!token) throw new Error("GitHub token unavailable");

  const res = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        q: `language:${languageQualifier(language.name)} type:user followers:>100 sort:followers-desc`,
        first: LIMIT,
      },
    }),
  });
  if (!res.ok) throw new Error(`GitHub search failed: ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      search: {
        nodes: Array<{
          login?: string;
          name?: string | null;
          location?: string | null;
          bio?: string | null;
          followers?: { totalCount: number };
        }>;
      };
    };
  };
  if (!json.data) throw new Error("GitHub search returned no data");

  // Organisations come back as empty nodes from the User fragment.
  return json.data.search.nodes
    .filter((n): n is Required<typeof n> => typeof n.login === "string")
    .map((n) => ({
      login: n.login,
      name: n.name?.trim() || null,
      followers: n.followers?.totalCount ?? 0,
      location: n.location?.trim() || null,
      bio: n.bio?.trim() || null,
    }))
    .sort((a, b) => b.followers - a.followers);
}

function fixture(language: TopLanguage): TopDeveloper[] {
  return ["playwright-user", "playwright-guest", "octocat"].map((login, i) => ({
    login,
    name: i === 0 ? "Playwright User" : null,
    followers: 3000 - i * 1000,
    location: i === 1 ? "Internet" : null,
    bio: i === 0 ? `Writes a lot of ${language.name}` : null,
  }));
}

/** Most-followed GitHub users for a language, refreshed daily. */
export async function getTopDevelopers(
  language: TopLanguage
): Promise<TopDeveloper[]> {
  if (process.env.PLAYWRIGHT_TEST === "true") return fixture(language);
  return unstable_cache(
    () => fetchTopDevelopers(language),
    ["top-developers", language.slug],
    { revalidate: 24 * 60 * 60, tags: ["top-developers"] }
  )();
}
