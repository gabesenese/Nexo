import { randomUUID } from "node:crypto";
import { prisma } from "../db/client.js";
import { helpCenterConnector } from "../connectors/helpCenter.js";
import { pdfConnector, type PdfInput } from "../connectors/pdf.js";
import type { FetchedSource } from "../connectors/base.js";
import { chunkDocuments, type ChunkResult } from "./chunking.js";
import { embeddingProvider } from "./embeddings.js";

const EMBED_BATCH_SIZE = 20;
const IN_PROGRESS_STATUSES = ["queued", "fetching", "chunking", "embedding"] as const;

export interface QueuedSource {
  sourceId: string;
  name: string;
}

export async function queueHelpCenterUrl(url: string, organizationId: string): Promise<QueuedSource> {
  const source = await prisma.source.create({
    data: { type: "help_center", name: url, origin: url, organizationId, status: "queued" },
  });
  void runPipeline(source.id, () => helpCenterConnector.fetch(url));
  return { sourceId: source.id, name: source.name };
}

export async function queuePdf(input: PdfInput, organizationId: string): Promise<QueuedSource> {
  const source = await prisma.source.create({
    data: { type: "pdf", name: input.filename, origin: input.filename, organizationId, status: "queued" },
  });
  void runPipeline(source.id, () => pdfConnector.fetch(input));
  return { sourceId: source.id, name: source.name };
}

/**
 * PDF sources don't retain the uploaded file, so there's nothing to re-fetch;
 * only help-center URLs (a stable origin) can be re-indexed in place.
 */
export async function reindexSource(sourceId: string, organizationId: string): Promise<void> {
  const source = await prisma.source.findFirst({ where: { id: sourceId, organizationId } });
  if (!source) throw new Error("source not found");
  if (source.type !== "help_center") {
    throw new Error("Only help-center sources can be re-indexed. Re-upload the file to refresh a PDF.");
  }
  await prisma.source.update({
    where: { id: sourceId },
    data: { status: "queued", errorMessage: null, totalChunks: null, processedChunks: 0 },
  });
  void runPipeline(sourceId, () => helpCenterConnector.fetch(source.origin));
}

/**
 * Marks any source left mid-pipeline by an unclean shutdown as failed, so it
 * doesn't sit "Indexing…" forever with no job left to advance it.
 */
export async function recoverInterruptedSources(): Promise<void> {
  await prisma.source.updateMany({
    where: { status: { in: [...IN_PROGRESS_STATUSES] } },
    data: { status: "failed", errorMessage: "Interrupted by a server restart. Re-index to try again." },
  });
}

async function runPipeline(sourceId: string, fetchFn: () => Promise<FetchedSource>): Promise<void> {
  try {
    await prisma.source.update({ where: { id: sourceId }, data: { status: "fetching" } });
    const fetched = await fetchFn();

    const chunks = chunkDocuments(fetched.documents);
    await prisma.source.update({
      where: { id: sourceId },
      data: { name: fetched.name, status: "chunking", totalChunks: chunks.length, processedChunks: 0 },
    });

    if (chunks.length === 0) {
      await prisma.chunk.deleteMany({ where: { sourceId } });
      await prisma.source.update({ where: { id: sourceId }, data: { status: "ready", lastSyncedAt: new Date() } });
      return;
    }

    await prisma.source.update({ where: { id: sourceId }, data: { status: "embedding" } });
    const embeddings = await embedWithProgress(sourceId, chunks);

    /**
     * Old chunks stay untouched until every new embedding has succeeded, so a
     * failed re-index never leaves a source with less knowledge than before.
     * The swap itself is one transaction: readers never see a half-replaced set.
     */
    await prisma.$transaction(async (tx) => {
      await tx.chunk.deleteMany({ where: { sourceId } });
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const vectorLiteral = `[${embeddings[i].join(",")}]`;
        const metadata = JSON.stringify({ headingPath: chunk.headingPath });
        await tx.$executeRaw`
          INSERT INTO "Chunk" (id, "sourceId", content, embedding, "tokenCount", metadata, "createdAt")
          VALUES (
            ${randomUUID()}, ${sourceId}, ${chunk.content}, ${vectorLiteral}::vector,
            ${chunk.tokenCount}, ${metadata}::jsonb, now()
          )
        `;
      }
    });

    await prisma.source.update({ where: { id: sourceId }, data: { status: "ready", lastSyncedAt: new Date() } });
  } catch (err) {
    await prisma.source
      .update({
        where: { id: sourceId },
        data: { status: "failed", errorMessage: (err as Error).message.slice(0, 500) },
      })
      .catch(() => {});
  }
}

async function embedWithProgress(sourceId: string, chunks: ChunkResult[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const batchEmbeddings = await embeddingProvider.embed(batch.map((c) => c.content));
    embeddings.push(...batchEmbeddings);
    await prisma.source
      .update({ where: { id: sourceId }, data: { processedChunks: embeddings.length } })
      .catch(() => {});
  }
  return embeddings;
}
