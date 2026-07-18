const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f7df1e",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Ruby: "#701516",
  Shell: "#89e051",
};

export interface PinnedRepoDetails {
  name: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: { name: string; color: string } | null;
  sparkline: number[];
}

export async function fetchPinnedRepoDetails(
  githubLogin: string,
  pinnedRepos: string[],
  token: string
): Promise<PinnedRepoDetails[]> {
  const GITHUB_API = "https://api.github.com";
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString();

  const results = await Promise.all(
    pinnedRepos.map(async (repoFullName) => {
      try {
        // 1. Fetch basic repository metadata
        const repoRes = await fetch(`${GITHUB_API}/repos/${repoFullName}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
          cache: "no-store",
        });

        if (!repoRes.ok) {
          // Gracefully skip private/deleted/not found repos
          return null;
        }

        const repoData = await repoRes.json();

        // 2. Fetch commits by author for the last 30 days
        const commitsRes = await fetch(
          `${GITHUB_API}/repos/${repoFullName}/commits?author=${githubLogin}&since=${sinceStr}&per_page=100`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
            },
            cache: "no-store",
          }
        );

        const commitsData = commitsRes.ok ? await commitsRes.json() : [];
        const commitsArray = Array.isArray(commitsData) ? commitsData : [];

        // Count commits by day (local YYYY-MM-DD format)
        const dailyCounts: Record<string, number> = {};
        for (const item of commitsArray) {
          if (item?.commit?.author?.date) {
            const dateStr = item.commit.author.date.slice(0, 10);
            dailyCounts[dateStr] = (dailyCounts[dateStr] ?? 0) + 1;
          }
        }

        // Fill in the 30-day sparkline array from 30 days ago to today
        const sparkline: number[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          sparkline.push(dailyCounts[dateStr] ?? 0);
        }

        return {
          name: repoFullName,
          description: repoData.description ?? null,
          url: repoData.html_url ?? `https://github.com/${repoFullName}`,
          stargazerCount: repoData.stargazers_count ?? 0,
          forkCount: repoData.forks_count ?? 0,
          primaryLanguage: repoData.language
            ? {
                name: repoData.language,
                color: LANGUAGE_COLORS[repoData.language] ?? "#8b949e",
              }
            : null,
          sparkline,
        };
      } catch (err) {
        console.error(`Failed to fetch spotlight details for ${repoFullName}:`, err);
        return null;
      }
    })
  );

  return results.filter((r): r is PinnedRepoDetails => r !== null);
}
