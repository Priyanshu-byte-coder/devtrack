export interface InvalidationEvent {
  username: string;
  repo?: string;
  timestamp: number;
}

type InvalidationListener = (event: InvalidationEvent) => void;

const listeners = new Set<InvalidationListener>();

/**
 * Subscribes a listener function to incoming real-time metric invalidation events.
 * Returns an unsubscribe callback.
 */
export function subscribeToMetricEvents(listener: InvalidationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Broadcasts an invalidation event across all connected SSE clients.
 */
export function broadcastMetricInvalidation(username: string, repo?: string): void {
  const event: InvalidationEvent = {
    username: username.toLowerCase(),
    repo,
    timestamp: Date.now(),
  };

  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Ignore errors from disconnected listeners
    }
  }
}
