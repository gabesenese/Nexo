/**
 * Fan-out for realtime updates. Subscribers are SSE connections held open by
 * this process, so delivery is in-memory and dies with the process. That is
 * deliberate for now: a dropped event costs a few seconds of staleness because
 * every client keeps a slow fallback poll, so the failure mode is the old
 * behaviour rather than a missed message. Running more than one server
 * instance would need a shared broker (Postgres LISTEN/NOTIFY or Redis) here,
 * since a customer's widget and their operator's dashboard could land on
 * different instances.
 */

export type OrgTopic = "conversations" | "attention" | "notifications";

type Listener = (payload: string) => void;

const listeners = new Map<string, Set<Listener>>();

export function orgChannel(organizationId: string): string {
  return `org:${organizationId}`;
}

export function sessionChannel(organizationId: string, sessionId: string): string {
  return `session:${organizationId}:${sessionId}`;
}

export function subscribe(channel: string, listener: Listener): () => void {
  let channelListeners = listeners.get(channel);
  if (!channelListeners) {
    channelListeners = new Set();
    listeners.set(channel, channelListeners);
  }
  channelListeners.add(listener);

  return () => {
    const current = listeners.get(channel);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(channel);
  };
}

function publish(channel: string, topics: string[]): void {
  const channelListeners = listeners.get(channel);
  if (!channelListeners || channelListeners.size === 0) return;
  const payload = JSON.stringify({ topics });
  for (const listener of channelListeners) listener(payload);
}

/** Tells every operator watching this workspace which views went stale. */
export function notifyOrg(organizationId: string, topics: OrgTopic[]): void {
  publish(orgChannel(organizationId), topics);
}

/** Tells one visitor's widget that their thread has new messages. */
export function notifySession(organizationId: string, sessionId: string): void {
  publish(sessionChannel(organizationId, sessionId), ["messages"]);
}

export function subscriberCount(channel: string): number {
  return listeners.get(channel)?.size ?? 0;
}
