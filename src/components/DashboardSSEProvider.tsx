"use client";

import { useEffect, useRef } from "react";

export default function DashboardSSEProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Determine if we need to fall back to periodic polling
    const startFallbackPolling = () => {
      if (fallbackIntervalRef.current) return;

      fallbackIntervalRef.current = setInterval(() => {
        // Dispatch generic events to trigger a re-fetch in listening components
        window.dispatchEvent(new CustomEvent("devtrack:sync"));
        window.dispatchEvent(new CustomEvent("devtrack:notifications"));
      }, 60000); // 60s polling
    };

    let eventSource: EventSource | null = null;

    if (typeof window !== "undefined" && window.EventSource) {
      try {
        eventSource = new EventSource("/api/stream");

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "update") {
              if (data.syncTriggered) {
                // Dispatch event so StreakTracker & GoalTracker can refetch
                window.dispatchEvent(
                  new CustomEvent("devtrack:sync", {
                    detail: { lastSyncedAt: data.lastSyncedAt },
                  })
                );
              }

              if (typeof data.unreadCount === "number") {
                // Dispatch event so NotificationBell can update/refetch
                window.dispatchEvent(
                  new CustomEvent("devtrack:notifications", {
                    detail: { unreadCount: data.unreadCount },
                  })
                );
              }
            }
          } catch (e) {
            console.error("Failed to parse SSE data", e);
          }
        };

        eventSource.onerror = () => {
          // EventSource automatically attempts to reconnect, but we can enable
          // the fallback polling just in case it's completely down.
          startFallbackPolling();
        };

        // When the connection opens successfully, we can clear the fallback polling
        // to save network requests, because SSE is working.
        eventSource.onopen = () => {
          if (fallbackIntervalRef.current) {
            clearInterval(fallbackIntervalRef.current);
            fallbackIntervalRef.current = null;
          }
        };
      } catch (e) {
        // Fallback to polling if EventSource initialization fails
        startFallbackPolling();
      }
    } else {
      // Fallback for browsers that don't support EventSource
      startFallbackPolling();
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }
    };
  }, []);

  return <>{children}</>;
}
