"use client";

import { type ReactNode, useMemo } from "react";
import { useAccount } from "@/components/AccountContext";
import { DashboardMetricsProvider } from "./DashboardMetricsContext";
import { useMetrics } from "@/hooks/useMetrics";

export default function DashboardMetricsLoader({ children }: { children: ReactNode }) {
  const { selectedAccount } = useAccount();
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const metricsParams = useMemo(
    () => ({ accountId: selectedAccount ?? undefined, timezone }),
    [selectedAccount, timezone],
  );
  const { data, loading, error, refetch } = useMetrics(metricsParams);

  return (
    <DashboardMetricsProvider
      value={{
        metrics: data,
        loading,
        error,
        refetch,
      }}
    >
      {children}
    </DashboardMetricsProvider>
  );
}
