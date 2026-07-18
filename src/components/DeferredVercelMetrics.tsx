"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

export default function DeferredVercelMetrics() {
  const [shouldLoadMetrics, setShouldLoadMetrics] = useState(false);
  const [Analytics, setAnalytics] = useState<ComponentType | null>(null);
  const [SpeedInsights, setSpeedInsights] = useState<ComponentType | null>(
    null,
  );

  useEffect(() => {
    if (shouldLoadMetrics) return;

    const browserWindow: IdleWindow = window;
    const loadMetrics = () => setShouldLoadMetrics(true);

    if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
      const idleCallbackId = browserWindow.requestIdleCallback(loadMetrics, {
        timeout: 3000,
      });

      return () => browserWindow.cancelIdleCallback?.(idleCallbackId);
    }

    const timeoutId = browserWindow.setTimeout(loadMetrics, 2000);

    return () => browserWindow.clearTimeout(timeoutId);
  }, [shouldLoadMetrics]);

  useEffect(() => {
    if (!shouldLoadMetrics) return;

    let isMounted = true;

    import("@vercel/analytics/next")
      .then((module) => {
        if (isMounted) setAnalytics(() => module.Analytics ?? null);
      })
      .catch(() => {});

    import("@vercel/speed-insights/next")
      .then((module) => {
        if (isMounted) setSpeedInsights(() => module.SpeedInsights ?? null);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [shouldLoadMetrics]);

  if (!shouldLoadMetrics || (!Analytics && !SpeedInsights)) return null;

  return (
    <>
      {Analytics ? <Analytics /> : null}
      {SpeedInsights ? <SpeedInsights /> : null}
    </>
  );
}
