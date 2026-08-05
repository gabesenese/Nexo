import { encode, decode } from "gpt-tokenizer";
import type { RawDocument } from "../connectors/base.js";

export const MIN_CHUNK_TOKENS = 200;
export const MAX_CHUNK_TOKENS = 500;
export const CHUNK_OVERLAP_TOKENS = 50;

export interface ChunkResult {
  content: string;
  tokenCount: number;
  headingPath: string[];
}

function splitLargeText(text: string, headingPath: string[]): ChunkResult[] {
  const tokens = encode(text);
  const chunks: ChunkResult[] = [];
  let start = 0;

  while (start < tokens.length) {
    const end = Math.min(start + MAX_CHUNK_TOKENS, tokens.length);
    const slice = tokens.slice(start, end);
    chunks.push({
      content: decode(slice).trim(),
      tokenCount: slice.length,
      headingPath,
    });
    if (end === tokens.length) break;
    start = end - CHUNK_OVERLAP_TOKENS;
  }

  return chunks;
}

/**
 * Groups documents (already heading-scoped by the connector) into
 * 200-500 token chunks with overlap for oversized sections. This is a
 * greedy heuristic, not a perfect semantic splitter: it favors keeping
 * a section's heading together over hitting the token target exactly.
 */
export function chunkDocuments(documents: RawDocument[]): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  let bufferParts: string[] = [];
  let bufferHeadingPath: string[] = [];
  let bufferTokens = 0;

  const flush = () => {
    if (bufferParts.length === 0) return;
    chunks.push({
      content: bufferParts.join("\n\n").trim(),
      tokenCount: bufferTokens,
      headingPath: bufferHeadingPath,
    });
    bufferParts = [];
    bufferTokens = 0;
  };

  for (const doc of documents) {
    const text = doc.text.trim();
    if (!text) continue;
    const docTokens = encode(text).length;

    if (docTokens > MAX_CHUNK_TOKENS) {
      flush();
      chunks.push(...splitLargeText(text, doc.headingPath));
      continue;
    }

    if (bufferTokens + docTokens > MAX_CHUNK_TOKENS && bufferTokens >= MIN_CHUNK_TOKENS) {
      flush();
    }

    if (bufferParts.length === 0) {
      bufferHeadingPath = doc.headingPath;
    }
    bufferParts.push(text);
    bufferTokens += docTokens;
  }
  flush();

  return chunks;
}
