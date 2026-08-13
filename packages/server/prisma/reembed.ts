import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { embeddingProvider } from "../src/ingestion/embeddings.js";
import { env, EMBEDDING_DIMENSIONS } from "../src/config/env.js";

const prisma = new PrismaClient();

/**
 * Re-embeds every stored vector with the currently configured provider.
 *
 * Needed because embeddings from two different models are not comparable, so
 * changing AI_PROVIDER silently invalidates every vector already in the
 * database: retrieval keeps returning results and they are meaningless. Nothing
 * in the schema records which model produced a given vector, so this is not
 * something the application can detect and warn about on its own.
 *
 * The run is deliberately a straight overwrite rather than a shadow column with
 * a cutover. During the run the corpus is a mix of two embedding spaces and
 * retrieval quality is undefined, which is acceptable precisely because this is
 * meant to happen before Nexo is serving anyone. Once there is live traffic,
 * this script is the wrong tool and the migration needs a second column.
 *
 * Safe to re-run and safe to interrupt: every row is rewritten from its own
 * source text, so a partial run just leaves work for the next one.
 */

const BATCH_SIZE = 64;

function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

async function reembedChunks(): Promise<number> {
  const total = await prisma.chunk.count();
  if (total === 0) return 0;

  let done = 0;
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.chunk.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, content: true },
    });
    if (batch.length === 0) break;

    const vectors = await embeddingProvider.embed(batch.map((c) => c.content));
    for (let i = 0; i < batch.length; i++) {
      await prisma.$executeRaw`
        UPDATE "Chunk" SET embedding = ${vectorLiteral(vectors[i])}::vector WHERE id = ${batch[i].id}
      `;
    }

    done += batch.length;
    cursor = batch[batch.length - 1].id;
    process.stdout.write(`  chunks ${done}/${total}\r`);
  }

  return done;
}

async function reembedEscalationQuestions(): Promise<number> {
  const rows = await prisma.$queryRaw<{ id: string; question: string }[]>`
    SELECT id, question FROM "Escalation" WHERE question IS NOT NULL ORDER BY id ASC
  `;
  if (rows.length === 0) return 0;

  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const vectors = await embeddingProvider.embed(batch.map((r) => r.question));

    for (let j = 0; j < batch.length; j++) {
      await prisma.$executeRaw`
        UPDATE "Escalation" SET "questionEmbedding" = ${vectorLiteral(vectors[j])}::vector WHERE id = ${batch[j].id}
      `;
      done++;
    }
    process.stdout.write(`  escalation questions ${done}/${rows.length}\r`);
  }

  return done;
}

async function main() {
  const model =
    env.AI_PROVIDER === "cloud" ? env.OPENAI_EMBEDDING_MODEL : env.OLLAMA_EMBEDDING_MODEL;
  console.log(`Provider: ${env.AI_PROVIDER} · model: ${model} · dimensions: ${EMBEDDING_DIMENSIONS}`);

  /** Proves the provider is reachable and returns the expected width before anything is overwritten. */
  const [probe] = await embeddingProvider.embed(["Nexo re-embed preflight"]);
  console.log(`Preflight: provider returned ${probe.length} dimensions.\n`);

  const chunks = await reembedChunks();
  console.log(`\nChunks re-embedded: ${chunks}`);

  const questions = await reembedEscalationQuestions();
  console.log(`\nEscalation questions re-embedded: ${questions}`);

  const stragglers = await prisma.$queryRaw<{ chunks: bigint; escalations: bigint }[]>`
    SELECT
      (SELECT COUNT(*)::bigint FROM "Chunk" WHERE embedding IS NULL) AS chunks,
      (SELECT COUNT(*)::bigint FROM "Escalation" WHERE question IS NOT NULL AND "questionEmbedding" IS NULL) AS escalations
  `;
  console.log(
    `\nStill unembedded: ${stragglers[0].chunks} chunks, ${stragglers[0].escalations} escalation questions.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
