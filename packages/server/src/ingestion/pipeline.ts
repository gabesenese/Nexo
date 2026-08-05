import { randomUUID } from "node:crypto";
import type { SourceType } from "@prisma/client";
import { prisma } from "../db/client.js";
import { helpCenterConnector } from "../connectors/helpCenter.js";
import { pdfConnector, type PdfInput } from "../connectors/pdf.js";
import type { FetchedSource } from "../connectors/base.js";
import { chunkDocuments } from "./chunking.js";
import { embeddingProvider } from "./embeddings.js";

export interface IngestResult {
  sourceId: string;
  name: string;
  chunkCount: number;
}

export async function ingestHelpCenterUrl(url: string): Promise<IngestResult> {
  const fetched = await helpCenterConnector.fetch(url);
  return persistSource("help_center", fetched);
}

export async function ingestPdf(input: PdfInput): Promise<IngestResult> {
  const fetched = await pdfConnector.fetch(input);
  return persistSource("pdf", fetched);
}

/**
 * Chunk.embedding is an Unsupported("vector(1536)") Prisma type, so it
 * can't go through prisma.chunk.create(). pgvector inserts happen via
 * raw SQL, with the embedding passed as a bracketed literal and cast
 * to ::vector.
 */
async function persistSource(type: SourceType, fetched: FetchedSource): Promise<IngestResult> {
  const source = await prisma.source.create({
    data: { type, name: fetched.name, origin: fetched.origin, lastSyncedAt: new Date() },
  });

  const chunks = chunkDocuments(fetched.documents);
  if (chunks.length === 0) {
    return { sourceId: source.id, name: source.name, chunkCount: 0 };
  }

  const embeddings = await embeddingProvider.embed(chunks.map((c) => c.content));

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vectorLiteral = `[${embeddings[i].join(",")}]`;
    const metadata = JSON.stringify({ headingPath: chunk.headingPath });

    await prisma.$executeRaw`
      INSERT INTO "Chunk" (id, "sourceId", content, embedding, "tokenCount", metadata, "createdAt")
      VALUES (
        ${randomUUID()}, ${source.id}, ${chunk.content}, ${vectorLiteral}::vector,
        ${chunk.tokenCount}, ${metadata}::jsonb, now()
      )
    `;
  }

  return { sourceId: source.id, name: source.name, chunkCount: chunks.length };
}
