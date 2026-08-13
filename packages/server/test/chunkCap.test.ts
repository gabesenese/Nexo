import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { applyChunkCap } from "../src/ingestion/pipeline.js";
import type { ChunkResult } from "../src/ingestion/chunking.js";

function chunks(count: number): ChunkResult[] {
  return Array.from({ length: count }, (_, i) => ({
    content: `chunk ${i}`,
    tokenCount: 10,
    headingPath: ["Article", `Section ${i}`],
  }));
}

describe("applyChunkCap", () => {
  it("passes a source under the cap through untouched and silent", () => {
    const input = chunks(5);
    const result = applyChunkCap(input);
    expect(result.chunks).toHaveLength(5);
    expect(result.notice).toBeNull();
  });

  it("keeps the cap exactly rather than truncating early", () => {
    const result = applyChunkCap(chunks(env.MAX_CHUNKS_PER_SOURCE));
    expect(result.chunks).toHaveLength(env.MAX_CHUNKS_PER_SOURCE);
    expect(result.notice).toBeNull();
  });

  it("truncates an oversized source and says so", () => {
    const result = applyChunkCap(chunks(env.MAX_CHUNKS_PER_SOURCE + 25));
    expect(result.chunks).toHaveLength(env.MAX_CHUNKS_PER_SOURCE);
    expect(result.notice).toContain(String(env.MAX_CHUNKS_PER_SOURCE));
    expect(result.notice).toMatch(/narrower URL/i);
  });

  it("keeps the earliest chunks, so the truncation is a prefix of the crawl", () => {
    const result = applyChunkCap(chunks(env.MAX_CHUNKS_PER_SOURCE + 1));
    expect(result.chunks[0].content).toBe("chunk 0");
    expect(result.chunks.at(-1)?.content).toBe(`chunk ${env.MAX_CHUNKS_PER_SOURCE - 1}`);
  });
});
