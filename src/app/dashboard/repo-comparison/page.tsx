"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function RepoComparisonPage() {
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
      alert("Invalid format! Use owner/repo (e.g. facebook/react)");
      return;
    }

    const [owner, repo] = parts;

    if (!owner || !repo) {
      alert("Invalid repository");
      return;
    }

    if (trimmed.includes(" ")) {
      alert("No spaces allowed in repository name");
      return;
    }

    if (repos.includes(trimmed)) return;

    if (repos.length >= 5) {
      alert("You can compare max 5 repositories only");
      return;
    }

    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`
      );

      if (!res.ok) {
        alert("Repository does not exist on GitHub");
        return;
      }

      const data = await res.json();

      setRepos([...repos, data.full_name]);
      setInput("");
    } catch {
      alert("Error validating repository");
    }
  };

  const removeRepo = (repo: string) => {
    setRepos(repos.filter((r) => r !== repo));
  };

  const fetchRepoData = async () => {
    if (repos.length < 2) {
      alert("Add at least 2 repositories to compare");
      return;
    }

    setLoading(true);
    setRepoData([]);

    try {
      const results = await Promise.all(
        repos.map(async (fullName) => {
          const res = await fetch(
            `https://api.github.com/repos/${fullName}`
          );

          if (!res.ok) return null;

          const data = await res.json();

          return {
            name: data.full_name,
            stars: data.stargazers_count,
            forks: data.forks_count,
            watchers: data.watchers_count,
            issues: data.open_issues_count,
          };
        })
      );

      setRepoData(results.filter((r): r is NonNullable<typeof r> => r !== null));
    } catch {
      alert("Failed to fetch repo data");
    }

    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Repository Comparison Analytics
      </h1>

      {/* INPUT */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="owner/repo (e.g. facebook/react)"
          className="border p-2 rounded w-80"
        />

        <button
          onClick={addRepo}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add Repo
        </button>
      </div>

      {/* REPO TAGS */}
      <div className="flex gap-2 flex-wrap">
        {repos.map((repo) => (
          <div
            key={repo}
            className="bg-gray-200 px-3 py-1 rounded flex gap-2 items-center"
          >
            <span>{repo}</span>
            <button onClick={() => removeRepo(repo)}>❌</button>
          </div>
        ))}
      </div>

      {/* COMPARE BUTTON */}
      <button
        onClick={fetchRepoData}
        className="bg-green-600 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? "Comparing..." : "Compare Repositories"}
      </button>

      {/* EMPTY STATE */}
      {repos.length === 0 && (
        <div className="text-gray-500">
          Add 2–5 repositories to compare
        </div>
      )}

      {/* RESULTS */}
      {repoData.length > 0 && (
        <div className="border rounded p-4">
          <h2 className="font-bold mb-3">Comparison Results</h2>

          {repoData.map((repo) => (
            <div key={repo.name} className="mb-3 p-2 border rounded">
              <p className="font-semibold">{repo.name}</p>
              <p>⭐ Stars: {repo.stars}</p>
              <p>🍴 Forks: {repo.forks}</p>
              <p>👀 Watchers: {repo.watchers}</p>
              <p>🐛 Issues: {repo.issues}</p>
            </div>
          ))}
        </div>
      )}
      {/* CHART */}
      {repoData.length > 0 && (
        <div className="w-full h-96 border rounded p-4 mt-6">
          <h2 className="font-bold mb-3">📊 Comparison Chart</h2>

          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
          <XAxis
            dataKey="name"
            tick={{ fill: "#7698fe", fontSize: 12 }}
          />
          <YAxis />
          <Tooltip />
          <Bar dataKey="stars" fill="#3b82f6" />
          <Bar dataKey="forks" fill="#10b981" />
          <Bar dataKey="watchers" fill="#f59e0b" />
          </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}