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

/**
 * Countries with a "Top developers in ..." page. `location` is what GitHub's
 * user search matches against the free-text location people set.
 */
export const TOP_COUNTRIES = [
  { slug: "india", name: "India", location: "India" },
  {
    slug: "united-states",
    name: "the United States",
    location: "United States",
  },
  { slug: "china", name: "China", location: "China" },
  { slug: "brazil", name: "Brazil", location: "Brazil" },
  { slug: "germany", name: "Germany", location: "Germany" },
  {
    slug: "united-kingdom",
    name: "the United Kingdom",
    location: "United Kingdom",
  },
  { slug: "canada", name: "Canada", location: "Canada" },
  { slug: "france", name: "France", location: "France" },
  { slug: "japan", name: "Japan", location: "Japan" },
  { slug: "indonesia", name: "Indonesia", location: "Indonesia" },
  { slug: "nigeria", name: "Nigeria", location: "Nigeria" },
  { slug: "pakistan", name: "Pakistan", location: "Pakistan" },
  { slug: "bangladesh", name: "Bangladesh", location: "Bangladesh" },
  { slug: "vietnam", name: "Vietnam", location: "Vietnam" },
  { slug: "spain", name: "Spain", location: "Spain" },
  { slug: "italy", name: "Italy", location: "Italy" },
  { slug: "netherlands", name: "the Netherlands", location: "Netherlands" },
  { slug: "poland", name: "Poland", location: "Poland" },
  { slug: "ukraine", name: "Ukraine", location: "Ukraine" },
  { slug: "turkey", name: "Turkey", location: "Turkey" },
  { slug: "south-korea", name: "South Korea", location: "South Korea" },
  { slug: "australia", name: "Australia", location: "Australia" },
  { slug: "egypt", name: "Egypt", location: "Egypt" },
  { slug: "kenya", name: "Kenya", location: "Kenya" },
  { slug: "mexico", name: "Mexico", location: "Mexico" },
  { slug: "argentina", name: "Argentina", location: "Argentina" },
  { slug: "philippines", name: "the Philippines", location: "Philippines" },
  { slug: "singapore", name: "Singapore", location: "Singapore" },
] as const;

export type TopCountry = (typeof TOP_COUNTRIES)[number];

export function findTopCountry(slug: string): TopCountry | undefined {
  return TOP_COUNTRIES.find((c) => c.slug === slug);
}

/** A language board or a country board. */
export type TopBoard = TopLanguage | TopCountry;

function isCountry(board: TopBoard): board is TopCountry {
  return "location" in board;
}

/** GitHub search query for a board. Exported for tests. */
export function boardQuery(board: TopBoard) {
  const filter = isCountry(board)
    ? `location:${quoteQualifier(board.location)}`
    : `language:${quoteQualifier(board.name)}`;
  return `${filter} type:user followers:>100 sort:followers-desc`;
}

export interface TopDeveloper {
  login: string;
  name: string | null;
  followers: number;
  location: string | null;
  bio: string | null;
}

const LIMIT = 30;

/** GitHub's search qualifier value; anything but plain letters is quoted. */
function quoteQualifier(value: string) {
  return /^[A-Za-z]+$/.test(value) ? value : `"${value}"`;
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

async function fetchTopDevelopers(board: TopBoard): Promise<TopDeveloper[]> {
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
        q: boardQuery(board),
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

function fixture(board: TopBoard): TopDeveloper[] {
  return ["playwright-user", "playwright-guest", "octocat"].map((login, i) => ({
    login,
    name: i === 0 ? "Playwright User" : null,
    followers: 3000 - i * 1000,
    location: i === 1 ? "Internet" : null,
    bio: i === 0 ? `Big in ${board.name}` : null,
  }));
}

/** Most-followed GitHub users for a language or country, refreshed daily. */
export async function getTopDevelopers(
  board: TopBoard
): Promise<TopDeveloper[]> {
  if (process.env.PLAYWRIGHT_TEST === "true") return fixture(board);
  return unstable_cache(
    () => fetchTopDevelopers(board),
    // Language keys stay as they were so existing cache entries still hit.
    isCountry(board)
      ? ["top-developers", "country", board.slug]
      : ["top-developers", board.slug],
    { revalidate: 24 * 60 * 60, tags: ["top-developers"] }
  )();
}
