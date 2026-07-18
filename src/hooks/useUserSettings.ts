"use client";

import { useCallback, useEffect, useState } from "react";

export type UserSettings = {
  id: string;
  github_login: string;
  bio: string;
  is_public: boolean;
  leaderboard_opt_in: boolean;
  weekly_digest_opt_in: boolean;
  pinned_repos: string[];
  has_wakatime_key: boolean;
  discord_webhook_url: string | null;
  timezone: string;
  webhook_url: string | null;
  discord_muted_until: string | null;
  preferred_locale: string;
};

export type UseUserSettingsResult<TData extends UserSettings = UserSettings> = {
  data: TData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export function useUserSettings(): UseUserSettingsResult {
  const [data, setData] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/user/settings");
      if (!res.ok) throw new Error(`Failed to fetch user settings (${res.status})`);
      const json = (await res.json()) as UserSettings;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to fetch user settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
