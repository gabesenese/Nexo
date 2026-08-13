import { describe, expect, it } from "vitest";
import { orderAndValidate } from "../src/ingestion/embeddings.js";
import { EMBEDDING_DIMENSIONS } from "../src/config/env.js";

function vector(length: number, seed = 0): number[] {
  return Array.from({ length }, (_, i) => (i + seed) / length);
}

describe("orderAndValidate", () => {
  it("restores the provider's response to the order the texts were sent in", () => {
    const out = orderAndValidate([
      { index: 2, embedding: vector(EMBEDDING_DIMENSIONS, 2) },
      { index: 0, embedding: vector(EMBEDDING_DIMENSIONS, 0) },
      { index: 1, embedding: vector(EMBEDDING_DIMENSIONS, 1) },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0][1]).toBeCloseTo(vector(EMBEDDING_DIMENSIONS, 0)[1]);
    expect(out[1][1]).toBeCloseTo(vector(EMBEDDING_DIMENSIONS, 1)[1]);
    expect(out[2][1]).toBeCloseTo(vector(EMBEDDING_DIMENSIONS, 2)[1]);
  });

  /**
   * The cutover failure this exists to catch: a model that ignores or rejects
   * the requested width returns its native size, and 1536 numbers written into
   * a corpus of 768-dim vectors is worse than an error, because retrieval keeps
   * returning results that mean nothing.
   */
  it("refuses a vector that is not the width both pgvector columns expect", () => {
    expect(() => orderAndValidate([{ index: 0, embedding: vector(1536) }])).toThrow(
      `Embedding model returned 1536 dims, expected ${EMBEDDING_DIMENSIONS}`,
    );
    expect(() => orderAndValidate([{ index: 0, embedding: vector(EMBEDDING_DIMENSIONS - 1) }])).toThrow(
      /expected/,
    );
  });

  it("passes an empty response through untouched", () => {
    expect(orderAndValidate([])).toEqual([]);
  });
});
