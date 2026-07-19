
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LandingPage, { type RepoStats } from "@/components/landing/LandingPage";
import { supabaseAdmin } from "@/lib/supabase";

import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

async function fetchRepoStats(): Promise<RepoStats> {
  if (
    process.env.NEXTAUTH_SECRET === "test-nextauth-secret-for-playwright-tests" ||
    process.env.PLAYWRIGHT_TEST === "true"
  ) {
    return {
      stars: 10,
      forks: 5,
      openIssues: 2,
      contributorCount: 3,
      goodFirstIssues: 1,
      contributors: [],
      totalCommits: 0,
      mergedPRs: 0,
    };
  }

  const token = process.env.GITHUB_TOKEN;
  const GH_HEADERS: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const OPTS = (ttl: number) => ({ next: { revalidate: ttl }, headers: GH_HEADERS });

  try {
    const [repoRes, contribRes, gfiRes, prsRes] = await Promise.all([
      fetch("https://api.github.com/repos/Priyanshu-byte-coder/devtrack", OPTS(3600)),
      fetch("https://api.github.com/repos/Priyanshu-byte-coder/devtrack/contributors?per_page=100", OPTS(3600)),
      fetch("https://api.github.com/repos/Priyanshu-byte-coder/devtrack/issues?labels=good+first+issue&state=open&per_page=100", OPTS(1800)),
      fetch("https://api.github.com/search/issues?q=repo:Priyanshu-byte-coder/devtrack+type:pr+is:merged&per_page=1", OPTS(3600)),
    ]);

    if (!repoRes.ok) throw new Error("repo fetch failed");

    const repo = (await repoRes.json()) as Record<string, unknown>;
    const contributors = contribRes.ok ? ((await contribRes.json()) as Array<Record<string, unknown>>) : [];
    const gfiIssues = gfiRes.ok ? ((await gfiRes.json()) as unknown[]) : [];
    const prsData = prsRes.ok ? ((await prsRes.json()) as { total_count?: number }) : null;

    // Total commits = sum of all contributors' contribution counts
    const totalCommits = Array.isArray(contributors)
      ? contributors.reduce((sum, c) => sum + (typeof c.contributions === "number" ? c.contributions : 0), 0)
      : 0;
    const mergedPRs = prsData?.total_count ?? 0;

    let mappedContributors = Array.isArray(contributors)
      ? contributors.slice(0, 20).map((c) => ({
          login: String(c.login ?? ""),
          avatar_url: String(c.avatar_url ?? ""),
          html_url: String(c.html_url ?? ""),
          isSponsor: false,
        }))
      : [];

    if (mappedContributors.length > 0 && supabaseAdmin) {
      try {
        const logins = mappedContributors.map((c) => c.login);
        const { data: sponsors } = await supabaseAdmin
          .from("users")
          .select("github_login")
          .in("github_login", logins)
          .eq("is_sponsor", true);

        if (sponsors && sponsors.length > 0) {
          const sponsorSet = new Set(sponsors.map((s: { github_login: string }) => s.github_login));
          mappedContributors = mappedContributors.map((c) => ({
            ...c,
            isSponsor: sponsorSet.has(c.login),
          }));
        }
      } catch (e) {
        // Supabase not configured locally — skip sponsor enrichment, show contributors as-is
      }
    }

    return {
      stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
      forks: typeof repo.forks_count === "number" ? repo.forks_count : 0,
      openIssues: typeof repo.open_issues_count === "number" ? repo.open_issues_count : 0,
      contributorCount: Array.isArray(contributors) ? contributors.length : 0,
      goodFirstIssues: Array.isArray(gfiIssues) ? gfiIssues.length : 0,
      contributors: mappedContributors,
      totalCommits,
      mergedPRs,
    };
  } catch (e) {
    return {
      stars: 0,
      forks: 0,
      openIssues: 0,
      contributorCount: 0,
      goodFirstIssues: 0,
      contributors: [],
      totalCommits: 0,
      mergedPRs: 0,
    };
  }
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  const stats = await fetchRepoStats();

  return (
    <div className={`${syne.variable} ${dmSans.variable} ${jetbrains.variable}`}>
      <LandingPage repoStats={stats} />
    </div>
  );
}
