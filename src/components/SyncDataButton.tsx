"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function SyncDataButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      window.dispatchEvent(new Event("devtrack:sync"));
      router.refresh();
      toast.success("Dashboard data synced");
    } catch (error) {
      console.error("Failed to sync dashboard data:", error);
      toast.error("Failed to sync data");
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  }, [isSyncing, router]);

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      title="Sync Data"
      aria-label="Sync dashboard data"
      className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--control)] p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--control-hover)] hover:text-[var(--foreground)] disabled:opacity-60"
    >
      <RefreshCw className={"h-4 w-4 " + (isSyncing ? "animate-spin" : "")} />
    </button>
  );
}
