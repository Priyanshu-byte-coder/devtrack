"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export interface UseRealtimeSyncOptions {
    /**
     * Row-level filter forwarded to Supabase Realtime, e.g. `"user_id=eq.abc-123"`.
     * Requires the table's RLS policies to allow reads for the anon role, or a
     * matching Realtime policy granting SELECT for the subscribing role.
     */
    filter?: string;
    /** Postgres schema to watch. Defaults to `"public"`. */
    schema?: string;
    /**
     * Polling interval (ms) used as a graceful fallback when the WebSocket
     * connection cannot be established or drops. Defaults to `60_000` ms.
     */
    fallbackPollingMs?: number;
}

export interface UseRealtimeSyncResult {
    /** `true` while the Supabase Realtime WebSocket subscription is active. */
    isLive: boolean;
}

// ---------------------------------------------------------------------------
// Lazy singleton client — one per browser tab, shared across hook instances
// ---------------------------------------------------------------------------

let _client: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!url || !key) return null;
    if (!_client) _client = createClient(url, key);
    return _client;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribes to Postgres row-change events on a Supabase table and calls
 * `onUpdate` whenever a matching event fires.
 *
 * Gracefully falls back to a `fallbackPollingMs` polling interval when the
 * WebSocket connection is unavailable or drops.
 *
 * @example
 * const { isLive } = useRealtimeSync(
 *   "goals",
 *   ["INSERT", "UPDATE", "DELETE"],
 *   loadGoals,
 *   { filter: `user_id=eq.${userId}` },
 * );
 */
export function useRealtimeSync(
    table: string,
    events: RealtimeEvent[],
    onUpdate: () => void,
    options: UseRealtimeSyncOptions = {},
): UseRealtimeSyncResult {
    const { filter, schema = "public", fallbackPollingMs = 60_000 } = options;

    const [isLive, setIsLive] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Keep callback ref fresh so subscription handlers never close over stale state.
    const onUpdateRef = useRef(onUpdate);
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    });

    const startPolling = useCallback(() => {
        if (pollingRef.current !== null) return;
        pollingRef.current = setInterval(() => {
            onUpdateRef.current();
        }, fallbackPollingMs);
    }, [fallbackPollingMs]);

    const stopPolling = useCallback(() => {
        if (pollingRef.current !== null) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    // Stabilise `events` so an inline array definition (e.g. `["INSERT", "DELETE"]`)
    // doesn't cause the effect to re-run on every render.
    const eventsKey = [...events].sort().join(",");

    useEffect(() => {
        const supabase = getSupabaseClient();

        if (!supabase) {
            // Supabase env vars not configured — degrade gracefully to polling only.
            startPolling();
            return () => stopPolling();
        }

        const channelName = `devtrack_${table}_${Math.random().toString(36).slice(2)}`;
        let channel = supabase.channel(channelName);

        for (const event of eventsKey.split(",") as RealtimeEvent[]) {
            channel = channel.on(
                "postgres_changes",
                {
                    event,
                    schema,
                    table,
                    ...(filter ? { filter } : {}),
                },
                () => {
                    onUpdateRef.current();
                },
            );
        }

        channel.subscribe((status) => {
            switch (status) {
                case "SUBSCRIBED":
                    setIsLive(true);
                    stopPolling();
                    break;
                case "CLOSED":
                case "CHANNEL_ERROR":
                case "TIMED_OUT":
                    setIsLive(false);
                    startPolling();
                    break;
                default:
                    break;
            }
        });

        channelRef.current = channel;

        return () => {
            setIsLive(false);
            stopPolling();
            // Non-blocking cleanup — safe to ignore the returned promise
            supabase.removeChannel(channel).catch(() => undefined);
            channelRef.current = null;
        };
        // eventsKey replaces the `events` array in the dep list to avoid
        // unnecessary re-subscriptions when the caller passes an inline literal.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table, schema, filter, eventsKey, startPolling, stopPolling]);

    return { isLive };
}