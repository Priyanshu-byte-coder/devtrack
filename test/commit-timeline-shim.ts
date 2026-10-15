/**
 * Route tests describe a user's commits as commit-search responses. The app
 * reads the commit timeline through GraphQL, so this shim answers those
 * GraphQL queries from whatever the test's fetch mock returns for the
 * equivalent commit search.
 */
type SearchCommit = {
  sha?: string;
  html_url?: string;
  commit: { author: { date: string }; message?: string };
  repository?: {
    full_name: string;
    html_url?: string;
    description?: string | null;
  };
};

const commitsByAuthor = new Map<string, SearchCommit[]>();

function json(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function commitTimelineShim(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const body = typeof init?.body === "string" ? init.body : "";
  if (
    !String(input).endsWith("/graphql") ||
    !/query Commit(Repos|History)\b/.test(body)
  )
    return fetch(input, init);
  const { variables } = JSON.parse(body) as {
    variables: Record<string, string | null>;
  };

  if (body.includes("query CommitRepos")) {
    const login = variables.login!;
    const q = `author:${login} author-date:>=${variables.year!.slice(0, 10)}`;
    const res = await fetch(
      `https://api.github.com/search/commits?q=${encodeURIComponent(q)}&per_page=100&page=1`,
      { headers: init?.headers }
    );
    if (!res.ok) return res;
    const items =
      ((await res.json()) as { items?: SearchCommit[] }).items ?? [];
    commitsByAuthor.set(`U_${login}`, items);
    const repos = [
      ...new Set(
        items.map((item) => item.repository?.full_name ?? "test/repo")
      ),
    ];
    return json({
      user: {
        id: `U_${login}`,
        year: {
          commitContributionsByRepository: repos.map((nameWithOwner) => ({
            repository: { nameWithOwner },
          })),
        },
        recent: { commitContributionsByRepository: [] },
      },
    });
  }

  const items = commitsByAuthor.get(variables.author!) ?? [];
  const data: Record<string, unknown> = {};
  for (let i = 0; variables[`o${i}`] !== undefined; i++) {
    const name = `${variables[`o${i}`]}/${variables[`n${i}`]}`;
    const own = items.filter(
      (item) => (item.repository?.full_name ?? "test/repo") === name
    );
    data[`r${i}`] = {
      nameWithOwner: name,
      url: own[0]?.repository?.html_url ?? `https://github.com/${name}`,
      description: own[0]?.repository?.description ?? null,
      defaultBranchRef: {
        target: {
          history: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: own.map((item, n) => ({
              oid: item.sha ?? `sha-${n}`,
              messageHeadline: item.commit.message ?? "",
              url: item.html_url ?? "",
              authoredDate: item.commit.author.date,
            })),
          },
        },
      },
    };
  }
  return json(data);
}
