/**
 * Whether a knowledge source is actually doing its job, expressed as one state
 * an operator can act on.
 *
 * A crawl made this necessary. When a source was a single page it either
 * worked or it didn't, so `status` said everything. A crawl can succeed and
 * still leave the workspace worse off than the operator believes: it can stop
 * at the chunk cap with most of a help centre unread, or it can be months out
 * of date because nothing re-crawls on its own. Both look like "Ready".
 */

export type SourceHealthState = "indexing" | "failed" | "empty" | "truncated" | "stale" | "ok";

/**
 * Nothing re-crawls on a schedule yet, so this is the point at which an
 * operator should be asked to re-index by hand rather than a claim about how
 * often help centres change.
 */
export const STALE_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SourceHealth {
  state: SourceHealthState;
  /** One sentence an operator can act on, or null when the source is simply fine. */
  detail: string | null;
  /** True when re-indexing is the thing that would help. */
  reindexable: boolean;
}

export interface SourceHealthInput {
  status: string;
  type: string;
  chunkCount: number;
  truncated: boolean;
  errorMessage: string | null;
  lastSyncedAt: Date | null;
}

function daysSince(at: Date, now: Date): number {
  return Math.floor((now.getTime() - at.getTime()) / DAY_MS);
}

/**
 * States are ordered by what an operator should deal with first, and only one
 * is reported: a source that is both truncated and stale is still missing
 * content after a re-index, so the truncation is the more useful thing to say.
 * A PDF is never stale, because there is no origin to re-fetch and telling
 * someone to refresh a file they cannot refresh is noise.
 */
export function sourceHealth(source: SourceHealthInput, now: Date = new Date()): SourceHealth {
  if (source.status === "failed") {
    return {
      state: "failed",
      detail: source.errorMessage ?? "This source failed to index.",
      reindexable: source.type === "help_center",
    };
  }

  if (source.status !== "ready") {
    return { state: "indexing", detail: null, reindexable: false };
  }

  if (source.chunkCount === 0) {
    return {
      state: "empty",
      detail: "Nothing readable was found here, so Nexo cannot answer from it.",
      reindexable: source.type === "help_center",
    };
  }

  if (source.truncated) {
    return {
      state: "truncated",
      detail: "Only part of this source is indexed. Add the rest as a second source pointed at a narrower URL.",
      reindexable: false,
    };
  }

  if (source.type === "help_center" && source.lastSyncedAt) {
    const age = daysSince(source.lastSyncedAt, now);
    if (age >= STALE_AFTER_DAYS) {
      return {
        state: "stale",
        detail: `Last indexed ${age} days ago. Re-index to pick up anything that changed.`,
        reindexable: true,
      };
    }
  }

  return { state: "ok", detail: null, reindexable: source.type === "help_center" };
}

export function needsAttention(health: SourceHealth): boolean {
  return health.state === "failed" || health.state === "empty" || health.state === "truncated" || health.state === "stale";
}
