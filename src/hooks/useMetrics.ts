"use client";

import { useCallback, useEffect, useState } from "react";

export type Metrics = Record<string, unknown>;

export type UseMetricsResult<TData extends Metrics = Metrics> = {
  data: TData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

function buildUrl(url: string, params?: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) searchParams.set(k, v);
    }
  }
  const qs = searchParams.toString();
  return qs ? `${url}?${qs}` : url;
}

export function useMetrics(): UseMetricsResult {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // NOTE: This hook intentionally targets the base `/api/metrics` endpoint.
      // Specific widgets may have their own endpoints; those should remain
      // component-specific unless explicitly migrated.
      const url = buildUrl("/api/metrics");

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch metrics (${res.status})`);
      }

      const json = (await res.json()) as Metrics;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to fetch metrics"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

