import { GITHUB_API } from "@/lib/github";

interface TopRepo { name: string; commits: number; }
interface WorkflowRun { conclusion: string | null; created_at: string; name: string | null; updated_at: string; }
export interface CIAnalyticsResponse { successRate: number; averageDurationMinutes: number; flakiestWorkflow: string | null; totalRuns: number; reposChecked: number; failedRepos?: string[]; }

function toIsoDate(daysAgo: number): string { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); }
function getRunDurationMinutes(run: WorkflowRun): number { const c = new Date(run.created_at).getTime(), u = new Date(run.updated_at).getTime(); return (isNaN(c) || isNaN(u) || u < c) ? 0 : (u - c) / 60000; }

export function mergeCIAnalytics(a: CIAnalyticsResponse, b: CIAnalyticsResponse): CIAnalyticsResponse {
  const totalRuns = a.totalRuns + b.totalRuns;
  const weightedDuration = totalRuns === 0 ? 0 : (a.averageDurationMinutes * a.totalRuns + b.averageDurationMinutes * b.totalRuns) / totalRuns;
  const successes = Math.round((a.successRate / 100) * a.totalRuns) + Math.round((b.successRate / 100) * b.totalRuns);
  return { successRate: totalRuns === 0 ? 0 : Math.round((successes / totalRuns) * 100), averageDurationMinutes: Math.round(weightedDuration * 10) / 10, flakiestWorkflow: a.flakiestWorkflow ?? b.flakiestWorkflow, totalRuns, reposChecked: a.reposChecked + b.reposChecked, failedRepos: [...(a.failedRepos ?? []), ...(b.failedRepos ?? [])] };
}

export async function fetchCIAnalyticsForAccount(token: string, githubLogin: string): Promise<CIAnalyticsResponse> {
  const searchRes = await fetch(`${GITHUB_API}/search/commits?q=author:${githubLogin}+author-date:>=${toIsoDate(30)}&per_page=100&sort=author-date&order=desc`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }, cache: "no-store" });
  if (!searchRes.ok) throw new Error("API error");
  const data = await searchRes.json();
  
  const repoMap = new Map<string, number>();
  for (const item of data.items) { const n = item.repository.full_name; repoMap.set(n, (repoMap.get(n) ?? 0) + 1); }
  const repos = Array.from(repoMap.entries()).map(([name, commits]) => ({ name, commits })).sort((a, b) => b.commits - a.commits).slice(0, 3);

  const failedRepos: string[] = [];
  const runsByRepo = await Promise.all(repos.map(async (repo) => {
    try {
      const res = await fetch(`${GITHUB_API}/repos/${repo.name}/actions/runs?per_page=100&created=>=${toIsoDate(30)}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (res.status === 404 || res.status === 403) return [];
      if (!res.ok) throw new Error("API error");
      const d = await res.json(); return d.workflow_runs ?? [];
    } catch (err) {
      console.error(`Failed to fetch signals for repo ${repo.name}:`, err);
      failedRepos.push(repo.name);
      return [];
    }
  }));

  const runs = runsByRepo.flat().filter((r: WorkflowRun) => r.conclusion);
  const successfulRuns = runs.filter((r: WorkflowRun) => r.conclusion === "success");
  const workflowStats = new Map<string, { failures: number, total: number }>();

  for (const run of runs) {
    const name = run.name ?? "Unnamed workflow";
    const stats = workflowStats.get(name) ?? { failures: 0, total: 0 };
    stats.total += 1; if (run.conclusion !== "success") stats.failures += 1;
    workflowStats.set(name, stats);
  }

  const flakiestWorkflow = Array.from(workflowStats.entries()).filter(([, s]) => s.failures > 0).sort((a, b) => (b[1].failures / b[1].total) - (a[1].failures / a[1].total) || b[1].failures - a[1].failures)[0]?.[0] ?? null;
  const totalDuration = runs.reduce((sum: number, run: any) => sum + getRunDurationMinutes(run), 0);

  return { successRate: runs.length === 0 ? 0 : Math.round((successfulRuns.length / runs.length) * 100), averageDurationMinutes: runs.length === 0 ? 0 : Math.round((totalDuration / runs.length) * 10) / 10, flakiestWorkflow, totalRuns: runs.length, reposChecked: repos.length, failedRepos };
}
