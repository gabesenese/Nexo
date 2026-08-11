const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type UpdateTopic = "conversations" | "attention" | "notifications";

type Handler = () => void;

/**
 * One connection serves the whole dashboard. Every view that used to poll
 * subscribes to the topics it cares about, so opening three panels costs one
 * socket rather than three timers.
 */
const handlers = new Map<UpdateTopic, Set<Handler>>();
let source: EventSource | null = null;

function open() {
  if (source) return;
  source = new EventSource(`${API_URL}/api/events`, { withCredentials: true });
  source.onmessage = (event) => {
    let topics: UpdateTopic[];
    try {
      topics = JSON.parse(event.data).topics ?? [];
    } catch {
      return;
    }
    for (const topic of topics) {
      handlers.get(topic)?.forEach((handler) => handler());
    }
  };
}

function closeIfIdle() {
  if (handlers.size > 0 || !source) return;
  source.close();
  source = null;
}

/**
 * EventSource reconnects on its own after a dropped connection, and stops for
 * good on a 401, which is what should happen once a session expires. Callers
 * keep a slow interval as well so a stopped stream degrades to polling instead
 * of a dashboard that quietly stops updating.
 */
export function subscribeToUpdates(topics: UpdateTopic[], handler: Handler): () => void {
  for (const topic of topics) {
    let topicHandlers = handlers.get(topic);
    if (!topicHandlers) {
      topicHandlers = new Set();
      handlers.set(topic, topicHandlers);
    }
    topicHandlers.add(handler);
  }
  open();

  return () => {
    for (const topic of topics) {
      const topicHandlers = handlers.get(topic);
      if (!topicHandlers) continue;
      topicHandlers.delete(handler);
      if (topicHandlers.size === 0) handlers.delete(topic);
    }
    closeIfIdle();
  };
}
