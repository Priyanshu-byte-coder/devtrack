"use client";

import { useCallback, useEffect, useState } from "react";

export type Notification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
};

export type NotificationsPayload = {
  notifications: Notification[];
  unreadCount: number;
};

export type UseNotificationsResult<TData extends NotificationsPayload = NotificationsPayload> = {
  data: TData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export function useNotifications(): UseNotificationsResult {
  const [data, setData] = useState<NotificationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error(`Failed to fetch notifications (${res.status})`);
      const json = (await res.json()) as NotificationsPayload;

      // Defensive normalization for robustness.
      setData({
        notifications: Array.isArray(json.notifications) ? json.notifications : [],
        unreadCount: typeof json.unreadCount === "number" ? json.unreadCount : 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to fetch notifications"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

