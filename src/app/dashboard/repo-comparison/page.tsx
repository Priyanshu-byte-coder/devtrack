"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function RepoComparisonPage() {
  const t = useTranslations("repoComparison");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);

  const [input, setInput] = useState("");
  const [repos, setRepos] = useState<string[]>([]);
  const [repoData, setRepoData] = useState<any[]>([]);
  const chartData = repoData?.length
    ? repoData.map((repo) => ({
        name: repo.name.split("/")[1],
        stars: repo.stars,
        forks: repo.forks,
        watchers: repo.watchers,
      }))
    : [];
  const [loading, setLoading] = useState(false);

  const addRepo = async () => {
    const trimmed = input.trim();
    const parts = trimmed.split("/");

    if (parts.length !== 2) {
      toast.error(t("errors.format"));
      return;
    }

    const [owner, repo] = parts;

    if (!owner || !repo) {
      toast.error(t("errors.missingOwnerOrRepo"));
      return;
    }

    if (trimmed.includes(" ")) {
      toast.error(t("errors.noSpaces"));
      return;
    }

    if (repos.includes(trimmed)) return;

    if (repos.length >= 5) {
      toast.error(t("errors.maxRepos"));
      return;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);

      if (!res.ok) {
        toast.error(t("errors.notFound"));
        return;
      }

      const data = await res.json();

      setRepos([...repos, data.full_name]);
      setInput("");
    } catch {
      toast.error(t("errors.networkCheck"));
    }
  };

  const removeRepo = (repo: string) => {
    setRepos(repos.filter((r) => r !== repo));
  };

  const fetchRepoData = async () => {
    if (repos.length < 2) {
      toast.error(t("errors.minRepos"));
      return;
    }

    setLoading(true);
    setRepoData([]);

    try {
      const results = await Promise.all(
        repos.map(async (fullName) => {
          const res = await fetch(`https://api.github.com/repos/${fullName}`);

          if (!res.ok) return null;

          const data = await res.json();

          return {
            name: data.full_name,
            stars: data.stargazers_count,
            forks: data.forks_count,
            watchers: data.subscribers_count,
            issues: data.open_issues_count,
          };
        })
      );

      setRepoData(
        results.filter((r): r is NonNullable<typeof r> => r !== null)
      );
    } catch {
      toast.error(t("errors.loadData"));
    }

    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* INPUT */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          aria-label={t("inputAria")}
          className="border p-2 rounded w-80"
        />

        <button
          onClick={addRepo}
          aria-label={t("addRepoAria")}
          className="bg-accent text-accent-foreground px-4 py-2 rounded"
        >
          {t("addRepo")}
        </button>
      </div>

      {/* REPO TAGS */}
      <div className="flex gap-2 flex-wrap">
        {repos.map((repo) => (
          <div
            key={repo}
            className="bg-card-muted px-3 py-1 rounded flex gap-2 items-center"
          >
            <span>{repo}</span>
            <button
              onClick={() => removeRepo(repo)}
              aria-label={t("removeRepoAria", { repo })}
            >
              <span aria-hidden="true">❌</span>
            </button>
          </div>
        ))}
      </div>

      {/* COMPARE BUTTON */}
      <button
        onClick={fetchRepoData}
        className="bg-success text-accent-foreground px-4 py-2 rounded"
        disabled={loading}
        aria-label={t("compareAria")}
      >
        {loading ? t("comparing") : t("compareRepos")}
      </button>

      {/* EMPTY STATE */}
      {repos.length === 0 && (
        <div className="text-muted-foreground">{t("emptyState")}</div>
      )}

      {/* RESULTS */}
      {repoData.length > 0 && (
        <div className="border rounded p-4">
          <h2 className="font-bold mb-3">{t("resultsHeading")}</h2>

          {repoData.map((repo) => (
            <div key={repo.name} className="mb-3 p-2 border rounded">
              <p className="font-semibold">{repo.name}</p>
              <p>
                {t("metrics.stars", {
                  count: numberFormatter.format(repo.stars),
                })}
              </p>
              <p>
                {t("metrics.forks", {
                  count: numberFormatter.format(repo.forks),
                })}
              </p>
              <p>
                {t("metrics.watchers", {
                  count: numberFormatter.format(repo.watchers),
                })}
              </p>
              <p>
                {t("metrics.issues", {
                  count: numberFormatter.format(repo.issues),
                })}
              </p>
            </div>
          ))}
        </div>
      )}
      {/* CHART */}
      {repoData.length > 0 && (
        <div className="w-full h-96 border rounded p-4 mt-6">
          <h2 className="font-bold mb-3">📊 {t("chartHeading")}</h2>

          <ResponsiveContainer
            width="100%"
            height="100%"
            aria-label={t("chartAria")}
          >
            <BarChart data={chartData} aria-label={t("chartAria")}>
              <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="stars"
                fill="var(--accent)"
                name={t("chartSeries.stars")}
              />
              <Bar
                dataKey="forks"
                fill="var(--success)"
                name={t("chartSeries.forks")}
              />
              <Bar
                dataKey="watchers"
                fill="var(--warning)"
                name={t("chartSeries.watchers")}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
