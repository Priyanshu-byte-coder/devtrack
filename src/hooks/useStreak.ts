"use client";

import { useCallback, useEffect, useState } from "react";

export type StreakData = {
  current: number;
  longest: number;
  lastCommitDate: string | null;
  totalActiveDays: number;
  freezeDates?: string[];
};

export type UseStreakResult<TData extends StreakData = StreakData> = {
  data: TData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export function useStreak(accountId?: string | null): UseStreakResult {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = accountId
        ? `/api/streak?accountId=${encodeURIComponent(accountId)}`
        : "/api/streak";

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch streak (${res.status})`);
      const json = (await res.json()) as StreakData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to fetch streak"));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

