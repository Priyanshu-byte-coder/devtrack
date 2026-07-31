"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DashboardMetricsData } from "@/types/dashboard-metrics";

interface DashboardMetricsContextValue {
  metrics: DashboardMetricsData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const DashboardMetricsContext = createContext<DashboardMetricsContextValue>({
  metrics: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

export function DashboardMetricsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: DashboardMetricsContextValue;
}) {
  return (
    <DashboardMetricsContext.Provider value={value}>
      {children}
    </DashboardMetricsContext.Provider>
  );
}

export function useDashboardMetrics() {
  return useContext(DashboardMetricsContext);
}
