"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DashboardWidgetId } from "@/lib/dashboard-layout";

type SummaryState = Partial<Record<DashboardWidgetId, string>>;
type UpdatingState = Partial<Record<DashboardWidgetId, boolean>>;

type DashboardWidgetA11yContextValue = {
  summaries: SummaryState;
  updating: UpdatingState;
  setSummary: (widgetId: DashboardWidgetId, text: string | null) => void;
  setIsUpdating: (widgetId: DashboardWidgetId, isUpdating: boolean) => void;
};

const DashboardWidgetA11yContext =
  createContext<DashboardWidgetA11yContextValue | null>(null);

export function DashboardWidgetA11yProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [summaries, setSummaries] = useState<SummaryState>({});
  const [updating, setUpdating] = useState<UpdatingState>({});

  const setSummary = useCallback(
    (widgetId: DashboardWidgetId, text: string | null) => {
      setSummaries((prev) => {
        if (text === null || text === "") {
          if (!(widgetId in prev)) return prev;
          const next = { ...prev };
          delete next[widgetId];
          return next;
        }
        return { ...prev, [widgetId]: text };
      });
    },
    [],
  );

  const setIsUpdating = useCallback(
    (widgetId: DashboardWidgetId, isUpdating: boolean) => {
      setUpdating((prev) => {
        if (!isUpdating) {
          if (!(widgetId in prev)) return prev;
          const next = { ...prev };
          delete next[widgetId];
          return next;
        }
        return { ...prev, [widgetId]: true };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      summaries,
      updating,
      setSummary,
      setIsUpdating,
    }),
    [summaries, updating, setSummary, setIsUpdating],
  );

  return (
    <DashboardWidgetA11yContext.Provider value={value}>
      {children}
    </DashboardWidgetA11yContext.Provider>
  );
}

export function useDashboardWidgetA11y(widgetId: DashboardWidgetId) {
  const context = useContext(DashboardWidgetA11yContext);

  const setSummaryForWidget = context?.setSummary;
  const setIsUpdatingForWidget = context?.setIsUpdating;

  const setSummary = useCallback(
    (text: string | null) => {
      if (setSummaryForWidget) {
        setSummaryForWidget(widgetId, text);
      }
    },
    [setSummaryForWidget, widgetId],
  );

  const setIsUpdating = useCallback(
    (isUpdating: boolean) => {
      if (setIsUpdatingForWidget) {
        setIsUpdatingForWidget(widgetId, isUpdating);
      }
    },
    [setIsUpdatingForWidget, widgetId],
  );

  return { setSummary, setIsUpdating };
}

export function useDashboardWidgetA11yState(widgetId: DashboardWidgetId) {
  const context = useContext(DashboardWidgetA11yContext);

  if (!context) {
    return { summary: undefined, isUpdating: false };
  }

  return {
    summary: context.summaries[widgetId],
    isUpdating: context.updating[widgetId] ?? false,
  };
}
