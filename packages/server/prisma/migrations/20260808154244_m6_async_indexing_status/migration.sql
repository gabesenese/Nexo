-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('queued', 'fetching', 'chunking', 'embedding', 'ready', 'failed');

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "processedChunks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "SourceStatus" NOT NULL DEFAULT 'queued',
ADD COLUMN     "totalChunks" INTEGER;

-- Backfill: sources ingested under the old synchronous pipeline already
-- finished, so they should read as "ready" rather than stuck "Queued…".
UPDATE "Source" s
SET "status" = 'ready',
    "totalChunks" = c.chunk_count,
    "processedChunks" = c.chunk_count
FROM (SELECT "sourceId", COUNT(*) AS chunk_count FROM "Chunk" GROUP BY "sourceId") c
WHERE s.id = c."sourceId" AND s."lastSyncedAt" IS NOT NULL;
