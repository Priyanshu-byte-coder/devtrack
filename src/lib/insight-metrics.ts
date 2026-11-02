import "server-only";
import { NextRequest } from "next/server";
import { GET as contributions } from "@/app/api/metrics/contributions/route";
import { GET as prs } from "@/app/api/metrics/prs/route";
import { GET as streak } from "@/app/api/metrics/streak/route";
import { GET as repos } from "@/app/api/metrics/repos/route";
export class InsightMetricsUnavailableError extends Error {
  constructor(public readonly response: Response) {
    super("Insight metrics unavailable");
  }
}
async function readMetric(
  handler: (req: NextRequest) => Promise<Response>,
  request: Request,
  path: string,
  required: string[]
) {
  const url = new URL(path, request.url);
  const response = await handler(
    new NextRequest(url, { headers: request.headers })
  );
  if (!response.ok) throw new InsightMetricsUnavailableError(response);
  const value = await response.json();
  if (
    !value ||
    value.complete === false ||
    required.some((key) => !(key in value))
  ) {
    throw new InsightMetricsUnavailableError(
      Response.json({ error: "Metrics are incomplete" }, { status: 503 })
    );
  }
  return value;
}
/** Calls the authenticated metric handlers in-process, using their shared cache and GitHub transport. */
export async function loadInsightMetrics(request: Request) {
  return Promise.all([
    readMetric(contributions, request, "/api/metrics/contributions?days=90", [
      "data",
      "total",
    ]),
    readMetric(prs, request, "/api/metrics/prs", ["open", "merged"]),
    readMetric(streak, request, "/api/metrics/streak", ["current", "longest"]),
    readMetric(repos, request, "/api/metrics/repos?days=90", ["repos"]),
  ]);
}
