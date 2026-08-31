"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface SSEListenerProps {
  userId: string;
}

export default function SSEListener({ userId }: SSEListenerProps) {
  const router = useRouter();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userId) return;
    let eventSource: EventSource | null = null;

    function startPolling() {
      pollingRef.current = setInterval(() => {
        router.refresh();
      }, 60000);
    }

    function connectSSE() {
      eventSource = new EventSource(`/api/stream?userId=${userId}`);

      eventSource.addEventListener("connected", () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      });

      eventSource.addEventListener("commit", () => {
        router.refresh();
      });

      eventSource.onerror = () => {
        eventSource?.close();
        startPolling();
      };
    }

    connectSSE();

    return () => {
      eventSource?.close();
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [userId, router]);

  return null;
}
