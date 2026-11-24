import { NextRequest } from "next/server";
import { subscribeToMetricEvents, InvalidationEvent } from "@/lib/metric-events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const targetUser = searchParams.get("username")?.toLowerCase();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: {"status":"connected"}\n\n`));

      const unsubscribe = subscribeToMetricEvents((event: InvalidationEvent) => {
        if (!targetUser || event.username === targetUser) {
          controller.enqueue(
            encoder.encode(`event: invalidate\ndata: ${JSON.stringify(event)}\n\n`)
          );
        }
      });

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      });
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
