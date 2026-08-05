import { describe, expect, it } from "vitest";
import { chunkDocuments, MAX_CHUNK_TOKENS, MIN_CHUNK_TOKENS } from "../src/ingestion/chunking.js";
import type { RawDocument } from "../src/connectors/base.js";

function words(n: number, prefix = "word"): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");
}

describe("chunkDocuments", () => {
  it("keeps small documents under one chunk without exceeding the max token bound", () => {
    const docs: RawDocument[] = [{ headingPath: ["Billing"], text: words(50) }];
    const chunks = chunkDocuments(docs);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokenCount).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);
  });

  it("merges consecutive small documents instead of emitting one chunk per document", () => {
    const docs: RawDocument[] = [
      { headingPath: ["Billing"], text: words(60) },
      { headingPath: ["Billing"], text: words(60) },
    ];
    const chunks = chunkDocuments(docs);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
    expect(chunks[0].tokenCount).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);
  });

  it("flushes and starts a new chunk once merging would exceed the max token bound", () => {
    const docs: RawDocument[] = [
      { headingPath: ["Billing"], text: words(150) },
      { headingPath: ["Billing"], text: words(150) },
    ];
    const chunks = chunkDocuments(docs);
    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);
    }
  });

  it("splits an oversized document into overlapping chunks, each within bounds", () => {
    const docs: RawDocument[] = [{ headingPath: ["Refunds"], text: words(1200) }];
    const chunks = chunkDocuments(docs);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });

  it("drops empty documents without producing empty chunks", () => {
    const docs: RawDocument[] = [{ headingPath: ["Empty"], text: "   " }];
    expect(chunkDocuments(docs)).toHaveLength(0);
  });
});
