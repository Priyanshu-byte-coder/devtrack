"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs compound components must be used within <Tabs>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Tabs (root)                                                        */
/* ------------------------------------------------------------------ */

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The controlled or default active tab value. */
  defaultValue: string;
  /** Optional controlled value. */
  value?: string;
  /** Callback when the active tab changes. */
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, value, onValueChange, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);

    const activeTab = value ?? internalValue;
    const setActiveTab = React.useCallback(
      (v: string) => {
        if (!value) setInternalValue(v);
        onValueChange?.(v);
      },
      [value, onValueChange]
    );

    return (
      <TabsContext.Provider value={{ activeTab, setActiveTab }}>
        <div ref={ref} className={cn("w-full", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

/* ------------------------------------------------------------------ */
/*  TabsList                                                           */
/* ------------------------------------------------------------------ */

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 border-b border-[var(--border)] w-full",
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = "TabsList";

/* ------------------------------------------------------------------ */
/*  TabsTrigger                                                        */
/* ------------------------------------------------------------------ */

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The value that identifies this tab. */
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, ...props }, ref) => {
    const { activeTab, setActiveTab } = useTabsContext();
    const isActive = activeTab === value;

    return (
      <button
        ref={ref}
        role="tab"
        type="button"
        aria-selected={isActive}
        data-state={isActive ? "active" : "inactive"}
        onClick={() => setActiveTab(value)}
        className={cn(
          "relative inline-flex items-center justify-center whitespace-nowrap px-3 py-2 text-sm font-medium transition-all",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]",
          "disabled:pointer-events-none disabled:opacity-50",
          isActive
            ? "text-[var(--accent)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
          className
        )}
        {...props}
      >
        {children}
        {/* Active underline */}
        <span
          className={cn(
            "absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all duration-200",
            isActive ? "bg-[var(--accent)]" : "bg-transparent"
          )}
        />
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

/* ------------------------------------------------------------------ */
/*  TabsContent                                                        */
/* ------------------------------------------------------------------ */

export interface TabsContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** The value that identifies which tab this content belongs to. */
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const { activeTab } = useTabsContext();

    if (activeTab !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        data-state="active"
        className={cn(
          "mt-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]",
          "animate-in fade-in-0 duration-200",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
