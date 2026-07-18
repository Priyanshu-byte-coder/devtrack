import ParticleBackground from "@/components/ParticleBackground";
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LandingPage, { type RepoStats } from "@/components/landing/LandingPage";

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
  const GH_HEADERS = { Accept: "application/vnd.github.v3+json" };
  const OPTS = (ttl: number) => ({ next: { revalidate: ttl }, headers: GH_HEADERS });

  try {
    const [repoRes, contribRes, gfiRes] = await Promise.all([
      fetch("https://api.github.com/repos/Priyanshu-byte-coder/devtrack", OPTS(3600)),
      fetch("https://api.github.com/repos/Priyanshu-byte-coder/devtrack/contributors?per_page=30", OPTS(3600)),
      fetch("https://api.github.com/repos/Priyanshu-byte-coder/devtrack/issues?labels=good+first+issue&state=open&per_page=100", OPTS(1800)),
    ]);

    if (!repoRes.ok) throw new Error("repo fetch failed");

    const repo = (await repoRes.json()) as Record<string, unknown>;
    const contributors = contribRes.ok ? ((await contribRes.json()) as Array<Record<string, unknown>>) : [];
    const gfiIssues = gfiRes.ok ? ((await gfiRes.json()) as unknown[]) : [];

    return {
      stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
      forks: typeof repo.forks_count === "number" ? repo.forks_count : 0,
      openIssues: typeof repo.open_issues_count === "number" ? repo.open_issues_count : 0,
      contributorCount: Array.isArray(contributors) ? contributors.length : 0,
      goodFirstIssues: Array.isArray(gfiIssues) ? gfiIssues.length : 0,
      contributors: Array.isArray(contributors)
        ? contributors.slice(0, 20).map((c) => ({
            login: String(c.login ?? ""),
            avatar_url: String(c.avatar_url ?? ""),
            html_url: String(c.html_url ?? ""),
          }))
        : [],
    };
  } catch {
    return {
      stars: 40,
      forks: 160,
      openIssues: 307,
      contributorCount: 30,
      goodFirstIssues: 36,
      contributors: [],
    };
  }
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  const repoStats = await fetchRepoStats();

  return (
  <div className={`relative ${syne.variable} ${dmSans.variable} ${jetbrains.variable}`}>
    <ParticleBackground />
    <LandingPage repoStats={repoStats} />
  </div>
);
}
