"use client";

import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";

const THRESHOLD = 3;
const WINDOW_MS = 30_000;

export default function ThrottleBanner() {
  const [visible, setVisible] = useState(false);
  const timestamps = useRef<number[]>([]);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const res = await originalFetch(...args);

      if (res.status === 429 || res.status === 502 || res.status === 503) {
        const now = Date.now();
        timestamps.current = timestamps.current.filter(
          (t) => now - t < WINDOW_MS
        );
        timestamps.current.push(now);

        if (timestamps.current.length >= THRESHOLD) {
          setVisible(true);
        }
      }

      return res;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 flex items-center justify-between gap-4">
      <p className="text-sm text-amber-200">
        Some features are temporarily unavailable due to usage limits. Data may
        be stale or missing — it will recover automatically.
      </p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="shrink-0 rounded-lg p-1 text-amber-300 hover:bg-amber-500/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
