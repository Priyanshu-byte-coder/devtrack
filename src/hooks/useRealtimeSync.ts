"use client";
import { useEffect, useRef } from "react";
export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";
export interface UseRealtimeSyncOptions { filter?: string; schema?: string; fallbackPollingMs?: number; }
export interface UseRealtimeSyncResult { isLive: boolean; }
/** NextAuth identities are enforced by our APIs. Anonymous database subscriptions
 * cannot authenticate them, so refresh through the authenticated API callback. */
export function useRealtimeSync(_table: string, _events: RealtimeEvent[], onUpdate: () => void, options: UseRealtimeSyncOptions = {}): UseRealtimeSyncResult {
  const callback = useRef(onUpdate);
  useEffect(() => { callback.current = onUpdate; }, [onUpdate]);
  const interval = Math.max(5000, options.fallbackPollingMs ?? 60000);
  useEffect(() => {
    let active = true; let pending = false;
    const refresh = async () => {
      if (!active || pending || document.visibilityState === 'hidden') return;
      pending = true;
      try { await callback.current(); } finally { pending = false; }
    };
    const tick = () => { void refresh().catch(() => undefined); };
    const timer = setInterval(tick, interval);
    window.addEventListener('focus', tick);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', tick); };
  }, [interval]);
  return { isLive: false };
}
