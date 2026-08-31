"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";

interface ProjectData {
  metrics: {
    total: number;
    toDo: number;
    inProgress: number;
    done: number;
    avgTimeToClose: number | null;
  };
  recentIssues: Array<{
    key: string;
    summary: string;
    status: string;
    statusCategory: string;
  }>;
}

interface JiraConnectFormData {
  jiraDomain: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function getStatusColor(status: string): string {
  if (status === "Done") return "text-[var(--success)]";
  if (status === "In Progress") return "text-[var(--muted-foreground)]";
  return "text-[var(--muted-foreground)]";
}

export default function ProjectMetrics() {
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<JiraConnectFormData>({
    jiraDomain: "",
    email: "",
    apiToken: "",
    projectKey: "",
  });
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetch("/api/integrations/jira")
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404) {
            return null;
          }
          throw new Error("API error");
        }
        return r.json();
      })
      .then((result) => {
        if (result?.error) {
          setError(result.error);
        } else if (result) {
          setData(result);
        }
      })
      .catch(() => setError("Failed to load project data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setConnectionError(null);

    try {
      const res = await fetch("/api/integrations/jira/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (!res.ok) {
        setConnectionError(result.error || "Connection failed");
        return;
      }

      setShowForm(false);
      setFormData({ jiraDomain: "", email: "", apiToken: "", projectKey: "" });
      fetchData();
    } catch (e) {
      setConnectionError("Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/integrations/jira/credentials", {
        method: "DELETE",
      });
      setData(null);
      setError(null);
    } catch (e) {
      console.error("Failed to disconnect Jira:", e);
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Project Tracking
          </h2>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-lg" />
          ))}
        </div>
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[60px] w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data && !error) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Project Tracking
          </h2>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:opacity-90"
          >
            Connect Jira
          </button>
        </div>
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-[var(--muted-foreground)] mb-3">
            Connect Jira to track issues alongside your code activity
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            See your issue status, velocity, and time to close
          </p>
        </div>
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--card)] rounded-xl p-6 w-full max-w-md border border-[var(--border)]">
              <h3 className="text-lg font-semibold mb-4 text-[var(--card-foreground)]">
                Connect Jira
              </h3>
              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label htmlFor="jiraDomain" className="block text-sm font-medium mb-1 text-[var(--foreground)]">
                    Jira Domain
                  </label>
                  <input
                    type="text"
                    id="jiraDomain"
                    placeholder="your-company.atlassian.net"
                    value={formData.jiraDomain}
                    onChange={(e) =>
                      setFormData({ ...formData, jiraDomain: e.target.value })
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-[var(--foreground)]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1 text-[var(--foreground)]">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-[var(--foreground)]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="apiToken" className="block text-sm font-medium mb-1 text-[var(--foreground)]">
                    API Token
                  </label>
                  <input
                    id="apiToken"
                    type="password"
                    placeholder="Get from id.atlassian.com/manage-profile"
                    value={formData.apiToken}
                    onChange={(e) =>
                      setFormData({ ...formData, apiToken: e.target.value })
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-[var(--foreground)]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="projectKey" className="block text-sm font-medium mb-1 text-[var(--foreground)]">
                    Project Key (optional)
                  </label>
                  <input
                    type="text"
                    id="projectKey"
                    placeholder="e.g. PROJ"
                    value={formData.projectKey}
                    onChange={(e) =>
                      setFormData({ ...formData, projectKey: e.target.value })
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-[var(--foreground)]"
                  />
                </div>
                {connectionError && (
                  <p className="text-sm text-[var(--destructive)]">{connectionError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={connecting}
                    className="flex-1 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    {connecting ? "Connecting..." : "Connect"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--control)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Project Tracking
          </h2>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:opacity-90"
          >
            Connect Jira
          </button>
        </div>
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchData}

            className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--card)] rounded-xl p-6 w-full max-w-md border border-[var(--border)]">
              <h3 className="text-lg font-semibold mb-4 text-[var(--card-foreground)]">
                Connect Jira
              </h3>
              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label htmlFor="jiraDomain" className="block text-sm font-medium mb-1 text-[var(--foreground)]">
                    Jira Domain
                  </label>
                  <input
                    type="text"
                    id="jiraDomain"
                    placeholder="your-company.atlassian.net"
                    value={formData.jiraDomain}
                    onChange={(e) =>
                      setFormData({ ...formData, jiraDomain: e.target.value })
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-[var(--foreground)]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1 text-[var(--foreground)]">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-[var(--foreground)]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="apiToken" className="block text-sm font-medium mb-1 text-[var(--foreground)]">
                    API Token
                  </label>
                  <input
                    id="apiToken"
                    type="password"
                    placeholder="Get from id.atlassian.com/manage-profile"
                    value={formData.apiToken}
                    onChange={(e) =>
                      setFormData({ ...formData, apiToken: e.target.value })
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-[var(--foreground)]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="projectKey" className="block text-sm font-medium mb-1 text-[var(--foreground)]">
                    Project Key (optional)
                  </label>
                  <input
                    type="text"
                    id="projectKey"
                    placeholder="e.g. PROJ"
                    value={formData.projectKey}
                    onChange={(e) =>
                      setFormData({ ...formData, projectKey: e.target.value })
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-[var(--foreground)]"
                  />
                </div>
                {connectionError && (
                  <p className="text-sm text-[var(--destructive)]">{connectionError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={connecting}
                    className="flex-1 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    {connecting ? "Connecting..." : "Connect"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--control)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const stats = [
    { label: "To Do", value: data?.metrics.toDo ?? 0 },
    { label: "In Progress", value: data?.metrics.inProgress ?? 0 },
    { label: "Done", value: data?.metrics.done ?? 0 },
    {
      label: "Avg Close Time",
      value: formatHours(data?.metrics.avgTimeToClose ?? null),
    },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
          Project Tracking
        </h2>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {disconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-[var(--control)] p-4 text-center"
          >
            <div className="text-2xl font-bold text-[var(--accent)]">
              {stat.value}
            </div>
            <div className="mt-1 text-sm text-[var(--muted-foreground)]">
              {stat.label}
        </div>
          </div>
      ))}
      </div>
      {data?.recentIssues && data.recentIssues.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3 text-[var(--muted-foreground)]">
            Recent Issues
          </h3>
          <div className="space-y-2">
            {data.recentIssues.slice(0, 5).map((issue) => (
              <div
                key={issue.key}
                className="flex items-center justify-between rounded-lg bg-[var(--control)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs text-[var(--accent)]">
                    {issue.key}
                  </span>
                  <p className="truncate text-sm text-[var(--foreground)]">
                    {issue.summary}
                  </p>
                </div>
                <span
                  className={`ml-3 text-xs font-medium ${getStatusColor(
                    issue.statusCategory === "done"
                      ? "Done"
                      : issue.statusCategory === "indeterminate"
                        ? "In Progress"
                        : "To Do"
                  )}`}
                >
                  {issue.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
