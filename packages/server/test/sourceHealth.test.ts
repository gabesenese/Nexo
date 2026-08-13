import { describe, expect, it } from "vitest";
import { STALE_AFTER_DAYS, needsAttention, sourceHealth, type SourceHealthInput } from "../src/knowledge/sourceHealth.js";

const NOW = new Date("2026-08-13T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function source(overrides: Partial<SourceHealthInput> = {}): SourceHealthInput {
  return {
    status: "ready",
    type: "help_center",
    chunkCount: 40,
    truncated: false,
    errorMessage: null,
    lastSyncedAt: daysAgo(1),
    ...overrides,
  };
}

describe("sourceHealth", () => {
  it("reports a healthy help center as ok with nothing to say", () => {
    const health = sourceHealth(source(), NOW);
    expect(health.state).toBe("ok");
    expect(health.detail).toBeNull();
    expect(needsAttention(health)).toBe(false);
  });

  it("surfaces the ingestion error on a failed source", () => {
    const health = sourceHealth(source({ status: "failed", errorMessage: "404 Not Found" }), NOW);
    expect(health.state).toBe("failed");
    expect(health.detail).toBe("404 Not Found");
    expect(needsAttention(health)).toBe(true);
  });

  it("still says something useful when a failed source has no error message", () => {
    const health = sourceHealth(source({ status: "failed", errorMessage: null }), NOW);
    expect(health.state).toBe("failed");
    expect(health.detail).not.toBeNull();
  });

  it("treats every in-progress status as indexing rather than judging it early", () => {
    for (const status of ["queued", "fetching", "chunking", "embedding"]) {
      const health = sourceHealth(source({ status, chunkCount: 0 }), NOW);
      expect(health.state).toBe("indexing");
      expect(needsAttention(health)).toBe(false);
    }
  });

  it("flags a source that indexed successfully but produced no chunks", () => {
    const health = sourceHealth(source({ chunkCount: 0 }), NOW);
    expect(health.state).toBe("empty");
    expect(needsAttention(health)).toBe(true);
  });

  it("flags a source that stopped at the chunk cap", () => {
    const health = sourceHealth(source({ truncated: true }), NOW);
    expect(health.state).toBe("truncated");
    expect(health.reindexable).toBe(false);
  });

  it("prefers truncation over staleness, since re-indexing would not fix it", () => {
    const health = sourceHealth(source({ truncated: true, lastSyncedAt: daysAgo(400) }), NOW);
    expect(health.state).toBe("truncated");
  });

  it("goes stale only once the threshold is reached", () => {
    expect(sourceHealth(source({ lastSyncedAt: daysAgo(STALE_AFTER_DAYS - 1) }), NOW).state).toBe("ok");

    const stale = sourceHealth(source({ lastSyncedAt: daysAgo(STALE_AFTER_DAYS) }), NOW);
    expect(stale.state).toBe("stale");
    expect(stale.reindexable).toBe(true);
    expect(stale.detail).toContain(`${STALE_AFTER_DAYS} days ago`);
  });

  it("never calls a PDF stale, because there is no origin to re-fetch", () => {
    const health = sourceHealth(source({ type: "pdf", lastSyncedAt: daysAgo(400) }), NOW);
    expect(health.state).toBe("ok");
    expect(health.reindexable).toBe(false);
  });

  it("still reports a PDF as empty or failed, which re-uploading can fix", () => {
    expect(sourceHealth(source({ type: "pdf", chunkCount: 0 }), NOW).state).toBe("empty");
    expect(sourceHealth(source({ type: "pdf", status: "failed" }), NOW).state).toBe("failed");
  });

  it("does not call a never-indexed source stale", () => {
    const health = sourceHealth(source({ lastSyncedAt: null }), NOW);
    expect(health.state).toBe("ok");
  });
});
