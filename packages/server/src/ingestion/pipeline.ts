import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";
import { helpCenterConnector } from "../connectors/helpCenter.js";
import { pdfConnector, type PdfInput } from "../connectors/pdf.js";
import type { FetchedSource } from "../connectors/base.js";
import { chunkDocuments, type ChunkResult } from "./chunking.js";
import { embeddingProvider } from "./embeddings.js";

const EMBED_BATCH_SIZE = 20;
const INSERT_BATCH_SIZE = 100;
const SWAP_TIMEOUT_MS = 120_000;
const SWAP_MAX_WAIT_MS = 15_000;
const IN_PROGRESS_STATUSES = ["queued", "fetching", "chunking", "embedding"] as const;

export interface QueuedSource {
  sourceId: string;
  name: string;
}

type FetchFn = (signal: AbortSignal) => Promise<FetchedSource>;

/**
 * Ingestion runs in this process, so it needs its own back pressure: a crawl
 * is now up to a hundred pages plus an embedding pass, and letting every
 * queued source start at once would multiply that by however many an operator
 * added. Sources wait in the "queued" status they already display until a slot
 * frees up. This is the seam a durable job queue replaces.
 */
const pending: { sourceId: string; fetchFn: FetchFn }[] = [];
let active = 0;

function enqueue(sourceId: string, fetchFn: FetchFn): void {
  pending.push({ sourceId, fetchFn });
  drain();
}

function drain(): void {
  while (active < env.INGESTION_CONCURRENCY && pending.length > 0) {
    const job = pending.shift()!;
    active++;
    void runPipeline(job.sourceId, job.fetchFn).finally(() => {
      active--;
      drain();
    });
  }
}

export async function queueHelpCenterUrl(url: string, organizationId: string): Promise<QueuedSource> {
  const source = await prisma.source.create({
    data: { type: "help_center", name: url, origin: url, organizationId, status: "queued" },
  });
  enqueue(source.id, (signal) => helpCenterConnector.fetch(url, signal));
  return { sourceId: source.id, name: source.name };
}

export async function queuePdf(input: PdfInput, organizationId: string): Promise<QueuedSource> {
  const source = await prisma.source.create({
    data: { type: "pdf", name: input.filename, origin: input.filename, organizationId, status: "queued" },
  });
  enqueue(source.id, () => pdfConnector.fetch(input));
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
    data: { status: "queued", errorMessage: null, notice: null, totalChunks: null, processedChunks: 0 },
  });
  enqueue(sourceId, (signal) => helpCenterConnector.fetch(source.origin, signal));
}

/**
 * A source left mid-pipeline by an unclean shutdown has no job left to advance
 * it. A help center can simply be crawled again from its origin, so it goes
 * back in the queue rather than surfacing as a failure the operator has to
 * notice and retry by hand. An upload has no file to re-read, so it fails.
 */
export async function recoverInterruptedSources(): Promise<void> {
  const interrupted = await prisma.source.findMany({
    where: { status: { in: [...IN_PROGRESS_STATUSES] } },
    select: { id: true, type: true, origin: true },
  });
  if (interrupted.length === 0) return;

  const resumable = interrupted.filter((s) => s.type === "help_center" && s.origin);
  const unrecoverable = interrupted.filter((s) => !resumable.includes(s));

  await prisma.source.updateMany({
    where: { id: { in: unrecoverable.map((s) => s.id) } },
    data: { status: "failed", errorMessage: "Interrupted by a server restart. Re-upload the file to try again." },
  });
  await prisma.source.updateMany({
    where: { id: { in: resumable.map((s) => s.id) } },
    data: { status: "queued", errorMessage: null, notice: null, totalChunks: null, processedChunks: 0 },
  });

  for (const source of resumable) {
    enqueue(source.id, (signal) => helpCenterConnector.fetch(source.origin, signal));
  }
}

/**
 * Caps what one source can cost to embed. The crawler already caps pages, but
 * pages vary enormously in length, so the ceiling that actually bounds the
 * embedding bill is counted in chunks. Indexing the first N rather than
 * refusing the source keeps a large help center useful, and the operator is
 * told it was truncated so they can point at a narrower section.
 */
export function applyChunkCap(chunks: ChunkResult[]): { chunks: ChunkResult[]; notice: string | null } {
  const cap = env.MAX_CHUNKS_PER_SOURCE;
  if (chunks.length <= cap) return { chunks, notice: null };
  return {
    chunks: chunks.slice(0, cap),
    notice:
      `This source was larger than one source can hold, so the first ${cap} sections were indexed. ` +
      `Add the rest as a second source pointed at a narrower URL.`,
  };
}

function humanDuration(ms: number): string {
  if (ms < 60_000) {
    const seconds = Math.max(1, Math.round(ms / 1000));
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  const minutes = Math.round(ms / 60_000);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

async function runPipeline(sourceId: string, fetchFn: FetchFn): Promise<void> {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), env.INGESTION_TIMEOUT_MS);
  const limit = humanDuration(env.INGESTION_TIMEOUT_MS);

  try {
    await Promise.race([
      ingest(sourceId, fetchFn, controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(new Error(`Indexing took longer than ${limit} and was stopped. Try a narrower URL.`)),
          { once: true },
        );
      }),
    ]);
  } catch (err) {
    await prisma.source
      .update({
        where: { id: sourceId },
        data: { status: "failed", errorMessage: (err as Error).message.slice(0, 500) },
      })
      .catch(() => {});
  } finally {
    clearTimeout(deadline);
    controller.abort();
  }
}

async function ingest(sourceId: string, fetchFn: FetchFn, signal: AbortSignal): Promise<void> {
  await prisma.source.update({ where: { id: sourceId }, data: { status: "fetching" } });
  const fetched = await fetchFn(signal);

  const { chunks, notice } = applyChunkCap(chunkDocuments(fetched.documents));
  await prisma.source.update({
    where: { id: sourceId },
    data: { name: fetched.name, status: "chunking", totalChunks: chunks.length, processedChunks: 0 },
  });

  if (chunks.length === 0) {
    await prisma.chunk.deleteMany({ where: { sourceId } });
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "ready", errorMessage: null, notice: null, lastSyncedAt: new Date() },
    });
    return;
  }

  await prisma.source.update({ where: { id: sourceId }, data: { status: "embedding" } });
  const embeddings = await embedWithProgress(sourceId, chunks, signal);

  /**
   * Old chunks stay untouched until every new embedding has succeeded, so a
   * failed re-index never leaves a source with less knowledge than before.
   * The swap itself is one transaction: readers never see a half-replaced set.
   *
   * Rows go in batched rather than one statement each. A crawled source runs to
   * hundreds or thousands of chunks, and a round trip per row does not finish
   * inside an interactive transaction's window.
   */
  await prisma.$transaction(
    async (tx) => {
      await tx.chunk.deleteMany({ where: { sourceId } });
      for (let i = 0; i < chunks.length; i += INSERT_BATCH_SIZE) {
        const rows = chunks.slice(i, i + INSERT_BATCH_SIZE).map((chunk, offset) => {
          const vectorLiteral = `[${embeddings[i + offset].join(",")}]`;
          const metadata = JSON.stringify({ headingPath: chunk.headingPath });
          return Prisma.sql`(
            ${randomUUID()}, ${sourceId}, ${chunk.content}, ${vectorLiteral}::vector,
            ${chunk.tokenCount}, ${metadata}::jsonb, now()
          )`;
        });
        await tx.$executeRaw`
          INSERT INTO "Chunk" (id, "sourceId", content, embedding, "tokenCount", metadata, "createdAt")
          VALUES ${Prisma.join(rows)}
        `;
      }
    },
    { timeout: SWAP_TIMEOUT_MS, maxWait: SWAP_MAX_WAIT_MS },
  );

  await prisma.source.update({
    where: { id: sourceId },
    data: { status: "ready", errorMessage: null, notice, lastSyncedAt: new Date() },
  });
}

async function embedWithProgress(
  sourceId: string,
  chunks: ChunkResult[],
  signal: AbortSignal,
): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    if (signal.aborted) throw new Error("Indexing was stopped before it finished.");
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const batchEmbeddings = await embeddingProvider.embed(batch.map((c) => c.content));
    embeddings.push(...batchEmbeddings);
    await prisma.source
      .update({ where: { id: sourceId }, data: { processedChunks: embeddings.length } })
      .catch(() => {});
  }
  return embeddings;
}
