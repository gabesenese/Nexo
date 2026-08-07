-- Switch the pgvector embedding column from 1536 (OpenAI text-embedding-3-small)
-- to 768 (local nomic-embed-text via Ollama). Safe drop/re-add: no chunks exist yet.
ALTER TABLE "Chunk" DROP COLUMN "embedding";
ALTER TABLE "Chunk" ADD COLUMN "embedding" vector(768);
