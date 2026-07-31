import { NextRequest, NextResponse } from "next/server";
import type { DashboardMetricsData } from "@/types/dashboard-metrics";

const DEFAULT_CONTRIBUTION_DAYS = 30;
const STREAK_CONTRIBUTION_DAYS = 365;
const PR_RANGE = "30d";

function buildQuery(params: Record<string, string | undefined>) {
  return new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined) as [string, string][],
  ).toString();
}

function buildInternalUrl(req: NextRequest, path: string, params: Record<string, string | undefined> = {}) {
  const url = new URL(path, req.url);
  const query = buildQuery(params);
  if (query) url.search = query;
  return url;
}

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId") ?? undefined;
  const timezone = req.nextUrl.searchParams.get("timezone") ?? undefined;

  const queryParams = {
    accountId,
  };

  const contributionQuery = {
    ...queryParams,
    days: String(DEFAULT_CONTRIBUTION_DAYS),
    timezone,
  };

  const contribution365Query = {
    ...queryParams,
    days: String(STREAK_CONTRIBUTION_DAYS),
    timezone,
  };

  const prQuery = {
    ...queryParams,
    range: PR_RANGE,
  };

  const endpoints = [
    {
      key: "weeklySummary",
      url: buildInternalUrl(req, "/api/metrics/weekly-summary", queryParams),
    },
    {
      key: "streak",
      url: buildInternalUrl(req, "/api/metrics/streak", queryParams),
    },
    {
      key: "contributions30",
      url: buildInternalUrl(req, "/api/metrics/contributions", contributionQuery),
    },
    {
      key: "contributions365",
      url: buildInternalUrl(req, "/api/metrics/contributions", contribution365Query),
    },
    {
      key: "prs",
      url: buildInternalUrl(req, "/api/metrics/prs", prQuery),
    },
    {
      key: "consistencyScore",
      url: buildInternalUrl(req, "/api/metrics/consistency-score", queryParams),
    },
    {
      key: "discussions",
      url: buildInternalUrl(req, "/api/metrics/discussions", queryParams),
    },
    {
      key: "issues",
      url: buildInternalUrl(req, "/api/metrics/issues", queryParams),
    },
  ] as const;

  const responses = await Promise.all(
    endpoints.map(async (endpoint) => {
      const res = await fetch(endpoint.url.toString(), { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Metric endpoint failed: ${endpoint.key}`);
      }
      return { key: endpoint.key, json: await res.json() };
    }),
  );

  const data = responses.reduce((acc, response) => {
    acc[response.key] = response.json;
    return acc;
  }, {} as DashboardMetricsData);

  return NextResponse.json(data);
}
