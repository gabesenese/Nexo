import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { embeddingProvider } from "../src/ingestion/embeddings.js";

const prisma = new PrismaClient();

const BATCH_SIZE = 20;

/**
 * Escalations created before the question was captured, and any whose
 * embedding failed at handoff time, are repaired here. The question is
 * recovered from the transcript: the last thing the customer said before
 * the handoff is what the AI could not answer.
 */
async function backfillQuestions() {
  const missing = await prisma.escalation.findMany({
    where: { question: null },
    select: { id: true, conversationId: true, createdAt: true },
  });

  let recovered = 0;
  for (const escalation of missing) {
    const question = await prisma.message.findFirst({
      where: {
        conversationId: escalation.conversationId,
        role: "user",
        createdAt: { lte: escalation.createdAt },
      },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });

    if (!question) continue;
    await prisma.escalation.update({
      where: { id: escalation.id },
      data: { question: question.content },
    });
    recovered++;
  }

  return { scanned: missing.length, recovered };
}

async function backfillEmbeddings() {
  const rows = await prisma.$queryRaw<{ id: string; question: string }[]>`
    SELECT id, question FROM "Escalation"
    WHERE question IS NOT NULL AND "questionEmbedding" IS NULL
  `;

  let embedded = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const vectors = await embeddingProvider.embed(batch.map((r) => r.question));

    for (let j = 0; j < batch.length; j++) {
      const literal = `[${vectors[j].join(",")}]`;
      await prisma.$executeRaw`
        UPDATE "Escalation" SET "questionEmbedding" = ${literal}::vector WHERE id = ${batch[j].id}
      `;
      embedded++;
    }
    process.stdout.write(`  embedded ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }

  return { pending: rows.length, embedded };
}

async function main() {
  const questions = await backfillQuestions();
  console.log(`Questions: ${questions.recovered} recovered from transcripts (${questions.scanned} missing).`);

  const embeddings = await backfillEmbeddings();
  console.log(`\nEmbeddings: ${embeddings.embedded} written (${embeddings.pending} were missing).`);

  const remaining = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "Escalation"
    WHERE reason = 'low_confidence' AND "questionEmbedding" IS NULL
  `;
  console.log(`Low-confidence escalations still without an embedding: ${remaining[0].count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
