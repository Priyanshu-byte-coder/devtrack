import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { activeStreamConnections, sseConnections } from "@/lib/sse";

export const dynamic = "force-dynamic";

//
// Security & Performance Safeguards for SSE (Server-Sent Events)
// ==============================================================
//
// 1. Per-user connection cap (MAX_CONNECTIONS_PER_USER = 4)
//    Prevents a single user's browser tabs from exhausting database capacity.
//
// 2. Reduced polling interval (POLL_INTERVAL_MS = 60s)
//    Changed from 2s to 60s per connection — 30x cheaper.
//    For 500 concurrent users: ~8 queries/sec instead of ~500 queries/sec.
//
// 3. Maximum connection duration (MAX_CONNECTION_DURATION_MS = 5 min)
//    Stale connections are forcibly closed even if the client never sends
//    an abort signal. EventSource reconnects automatically.
//
// 4. Active connection tracking via activeStreamConnections Map
//    Prevents race conditions between connection registration and cleanup.
//
// 5. Abort signal handling (req.signal.addEventListener('abort'))
//    Resources are cleaned up immediately when the client disconnects.
//
// 6. Safe enqueue with try/catch
//    If the client goes away, the stream is closed gracefully.
//
// These safeguards prevent the query-storm scenario described in #1687.
//

// Maximum number of concurrent SSE connections allowed per authenticated user.
const MAX_CONNECTIONS_PER_USER = 4;

// How often each connection polls the database (60s interval).
const POLL_INTERVAL_MS = 60_000;

// Maximum lifetime for any single SSE connection (5 minutes).
const MAX_CONNECTION_DURATION_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId || !session.githubLogin) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const userId = user.id;

  // Enforce per-user connection cap before opening the stream.
  const current = activeStreamConnections.get(userId) ?? 0;
  if (current >= MAX_CONNECTIONS_PER_USER) {
    return new Response(
      JSON.stringify({ error: "Too many concurrent stream connections" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "30",
        },
      }
    );
  }

  // Register this connection before the stream starts so that the count is
  // accurate even if two requests race during the check above.
  activeStreamConnections.set(userId, current + 1);

  let lastCheckedSyncedAt: string | null = null;
  let lastCheckedUnreadCount: number | null = null;
  let cleanupStream: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      let connectionsSet = sseConnections.get(userId);
      if (!connectionsSet) {
        connectionsSet = new Set();
        sseConnections.set(userId, connectionsSet);
      }
      connectionsSet.add(controller);
      let interval: ReturnType<typeof setInterval>;
      let maxDurationTimeout: ReturnType<typeof setTimeout>;

      const releaseConnectionSlot = () => {
        const remaining = activeStreamConnections.get(userId) ?? 1;
        if (remaining <= 1) {
          activeStreamConnections.delete(userId);
        } else {
          activeStreamConnections.set(userId, remaining - 1);
        }
      };

      const closeStream = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        clearInterval(interval);
        clearTimeout(maxDurationTimeout);

        const connectionsSet = sseConnections.get(userId);
        if (connectionsSet) {
          connectionsSet.delete(controller);
          if (connectionsSet.size === 0) {
            sseConnections.delete(userId);
          }
        }

        try {
          controller.close();
        } catch {
          // The stream may already be closed/canceled by the client.
        }

        releaseConnectionSlot();
      };

      const safeEnqueue = (message: string) => {
        if (isClosed) {
          return;
        }

        try {
          controller.enqueue(message);
        } catch {
          closeStream();
        }
      };

      const checkData = async () => {
        try {
          if (isClosed) {
            return;
          }

          const { data: goals } = await supabaseAdmin
            .from("goals")
            .select("last_synced_at")
            .eq("user_id", userId)
            .order("last_synced_at", { ascending: false })
            .limit(1);

          const currentSyncedAt = goals?.[0]?.last_synced_at || null;

          const { count } = await supabaseAdmin
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("read", false);

          const currentUnreadCount = count ?? 0;

          let hasChanges = false;
          const payload: Record<string, unknown> = { type: "update" };

          if (lastCheckedSyncedAt !== currentSyncedAt) {
            hasChanges = true;
            payload.lastSyncedAt = currentSyncedAt;
            payload.syncTriggered = lastCheckedSyncedAt !== null;
            lastCheckedSyncedAt = currentSyncedAt;
          }

          if (lastCheckedUnreadCount !== currentUnreadCount) {
            hasChanges = true;
            payload.unreadCount = currentUnreadCount;
            lastCheckedUnreadCount = currentUnreadCount;
          }

          if (hasChanges) {
            safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
          }
        } catch (error) {
          console.error("SSE Polling Error:", error);
        }
      };

      // Register the interval and abort handler synchronously so they are
      // guaranteed to be in place before any async work begins. This prevents
      // a race where abort() fires before the listener is attached.
      interval = setInterval(() => {
        checkData();
      }, POLL_INTERVAL_MS);

      maxDurationTimeout = setTimeout(
        closeStream,
        MAX_CONNECTION_DURATION_MS
      );

      cleanupStream = closeStream;
      if (req.signal.aborted) {
        closeStream();
      } else {
        req.signal.addEventListener("abort", closeStream, { once: true });
      }

      // Kick off the first poll immediately (non-blocking).
      checkData();
    },
    cancel() {
      cleanupStream?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
