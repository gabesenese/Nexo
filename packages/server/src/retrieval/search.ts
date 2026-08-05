import { prisma } from "../db/client.js";
import { embeddingProvider } from "../ingestion/embeddings.js";

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  sourceName: string;
  content: string;
  headingPath: string[];
  score: number;
}

interface RawRow {
  id: string;
  sourceId: string;
  sourceName: string;
  content: string;
  metadata: { headingPath?: string[] };
  score: number;
}

const DENSE_WEIGHT = 0.6;
const KEYWORD_WEIGHT = 0.4;

function normalize(rows: RawRow[]): RawRow[] {
  if (rows.length === 0) return rows;
  const max = Math.max(...rows.map((r) => r.score));
  const min = Math.min(...rows.map((r) => r.score));
  const range = max - min || 1;
  return rows.map((r) => ({ ...r, score: (r.score - min) / range }));
}

/**
 * Hybrid retrieval: dense pgvector cosine similarity + Postgres keyword
 * full-text search, merged by weighted normalized score. Support content
 * is full of exact terms (SKUs, error codes) that pure vector search can
 * miss, so keyword matches are still weighted in even when the dense
 * search alone would rank them low.
 *
 * A cross-encoder re-ranking step (e.g. Cohere rerank) is a natural next
 * addition on top of this merged candidate set, not implemented in this
 * pass.
 */
export async function hybridSearch(query: string, topK = 6): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embeddingProvider.embed([query]);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const denseRows = await prisma.$queryRaw<RawRow[]>`
    SELECT c.id, c."sourceId", s.name AS "sourceName", c.content, c.metadata,
      (1 - (c.embedding <=> ${vectorLiteral}::vector))::float AS score
    FROM "Chunk" c
    JOIN "Source" s ON s.id = c."sourceId"
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK * 2}
  `;

  const keywordRows = await prisma.$queryRaw<RawRow[]>`
    SELECT c.id, c."sourceId", s.name AS "sourceName", c.content, c.metadata,
      ts_rank(to_tsvector('english', c.content), websearch_to_tsquery('english', ${query}))::float AS score
    FROM "Chunk" c
    JOIN "Source" s ON s.id = c."sourceId"
    WHERE to_tsvector('english', c.content) @@ websearch_to_tsquery('english', ${query})
    ORDER BY score DESC
    LIMIT ${topK * 2}
  `;

  const merged = new Map<string, RetrievedChunk>();

  for (const row of normalize(denseRows)) {
    merged.set(row.id, {
      id: row.id,
      sourceId: row.sourceId,
      sourceName: row.sourceName,
      content: row.content,
      headingPath: row.metadata?.headingPath ?? [],
      score: row.score * DENSE_WEIGHT,
    });
  }

  for (const row of normalize(keywordRows)) {
    const existing = merged.get(row.id);
    if (existing) {
      existing.score += row.score * KEYWORD_WEIGHT;
    } else {
      merged.set(row.id, {
        id: row.id,
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        content: row.content,
        headingPath: row.metadata?.headingPath ?? [],
        score: row.score * KEYWORD_WEIGHT,
      });
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, topK);
}
