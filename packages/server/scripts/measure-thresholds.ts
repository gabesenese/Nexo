import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { embeddingProvider } from "../src/ingestion/embeddings.js";
import { env, EMBEDDING_DIMENSIONS } from "../src/config/env.js";
import { activeThresholds } from "../src/knowledge/gaps.js";

/**
 * Measures the two thresholds that depend on the embedding space, so changing
 * the embedding model is a measurement rather than a guess.
 *
 * Both numbers in `knowledge/gaps.ts` are cosine similarities, and cosine
 * similarities from two different models are not comparable: a value of 0.57
 * means something different under every model. Swapping providers therefore
 * invalidates both thresholds even though nothing about the code changed. This
 * script prints the two bands each threshold has to sit between, so the new
 * value is read off real data instead of carried over.
 *
 *   npm run measure:thresholds --workspace=@nexo/server
 *
 * Run it against the demo workspace after re-embedding, once per provider.
 * A threshold is only defensible when the bands do not overlap; if they do,
 * the answer is better fixtures or a different signal, not a nudged number.
 */

const prisma = new PrismaClient();

/**
 * Different ways one customer asks one thing. The clustering threshold must sit
 * above this band's floor and below the cross-set ceiling. The demo corpus
 * cannot supply this: it repeats question text verbatim, so its same-topic
 * pairs score 1.0 and hide where the real floor is.
 */
const PARAPHRASE_SETS: string[][] = [
  [
    "Can we enforce SSO for everyone in the workspace?",
    "Is there a way to require single sign-on for all our users?",
    "How do I make SAML login mandatory across the account?",
    "Can I stop people signing in with a password once SSO is on?",
  ],
  [
    "Which region is our data stored in, and can we choose EU-only?",
    "Where does our customer data physically live?",
    "Can we pin data residency to Europe?",
    "Do you offer EU-only hosting for our records?",
  ],
  [
    "Can I get a refund for the seats we didn't use last quarter?",
    "How do I get money back for unused licences?",
    "We over-bought seats. Is that refundable?",
    "Can you credit us for seats we never assigned?",
  ],
  [
    "How many times do webhooks retry before you give up?",
    "What is the retry policy for failed webhook deliveries?",
    "If my endpoint is down, how often will you resend the event?",
    "How long do you keep retrying a webhook that keeps failing?",
  ],
  [
    "Do you have a SOC 2 report we can share with our security team?",
    "Can you complete our vendor security questionnaire?",
    "We need compliance documentation for a security review.",
    "Is there an audit report available for procurement?",
  ],
];

const DEMO_WORKSPACE = "Meridian (demo)";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

interface Band {
  n: number;
  min: number;
  p05: number;
  median: number;
  p95: number;
  max: number;
}

function band(values: number[]): Band | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
  return { n: sorted.length, min: sorted[0], p05: at(0.05), median: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] };
}

function show(name: string, b: Band | null) {
  if (!b) return console.log(`  ${name.padEnd(24)} no data`);
  console.log(
    `  ${name.padEnd(24)} n=${String(b.n).padStart(4)}  min=${b.min.toFixed(3)}  p05=${b.p05.toFixed(3)}  median=${b.median.toFixed(3)}  p95=${b.p95.toFixed(3)}  max=${b.max.toFixed(3)}`,
  );
}

/**
 * Compared at the 5th and 95th percentiles rather than the extremes, so one
 * mislabelled fixture cannot declare an otherwise clean split unusable.
 */
function recommend(label: string, high: Band | null, low: Band | null) {
  if (!high || !low) return console.log(`  ${label}: not enough data to recommend a threshold`);
  if (high.p05 <= low.p95) {
    console.log(`  ${label}: BANDS OVERLAP (${high.p05.toFixed(3)} vs ${low.p95.toFixed(3)}).`);
    console.log(`  No cutoff separates them. Do not pick a number; fix the fixtures or the signal.`);
    return;
  }
  console.log(
    `  ${label}: clean separation. Suggested threshold ${(((high.p05 + low.p95) / 2)).toFixed(3)} (between ${low.p95.toFixed(3)} and ${high.p05.toFixed(3)}).`,
  );
}

async function main() {
  const model = env.AI_PROVIDER === "cloud" ? env.OPENAI_EMBEDDING_MODEL : env.OLLAMA_EMBEDDING_MODEL;
  console.log(`\nProvider: ${env.AI_PROVIDER} · model: ${model} · dimensions: ${EMBEDDING_DIMENSIONS}`);
  const configured = activeThresholds;
  console.log(
    `Currently configured for this provider: clustering ${configured.similarity} · coverage ${configured.coverage}`,
  );
  console.log(`Compare each suggestion below against those before changing anything.`);

  const org = await prisma.organization.findFirst({ where: { name: DEMO_WORKSPACE } });
  if (!org) throw new Error(`"${DEMO_WORKSPACE}" not found. Run: npm run db:seed:demo`);

  const flat = PARAPHRASE_SETS.flat();
  const setIndex = PARAPHRASE_SETS.flatMap((set, i) => set.map(() => i));
  const vectors = await embeddingProvider.embed(flat);

  const paraphrase: number[] = [];
  const differentAsk: number[] = [];
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      (setIndex[i] === setIndex[j] ? paraphrase : differentAsk).push(cosine(vectors[i], vectors[j]));
    }
  }

  console.log(`\nCLUSTERING  (SIMILARITY_THRESHOLD: two questions are the same gap above this)`);
  show("paraphrases of one ask", band(paraphrase));
  show("different asks", band(differentAsk));
  recommend("clustering", band(paraphrase), band(differentAsk));

  /** Uncovered: escalation topics the demo seed deliberately leaves undocumented. */
  const uncovered = await prisma.$queryRaw<{ similarity: number }[]>`
    SELECT n.similarity
    FROM "Escalation" e
    JOIN "Conversation" c ON c.id = e."conversationId"
    JOIN LATERAL (
      SELECT (1 - (ch.embedding <=> e."questionEmbedding"))::float AS similarity
      FROM "Chunk" ch JOIN "Source" s ON s.id = ch."sourceId"
      WHERE ch.embedding IS NOT NULL AND s."organizationId" = ${org.id}
      ORDER BY ch.embedding <=> e."questionEmbedding" LIMIT 1
    ) n ON true
    WHERE c."organizationId" = ${org.id}
      AND e.reason = 'low_confidence'
      AND e."questionEmbedding" IS NOT NULL
  `;

  /** Covered: the opening question of every conversation the AI resolved on its own. */
  const resolved = await prisma.$queryRaw<{ question: string }[]>`
    SELECT DISTINCT ON (c.id) m.content AS question
    FROM "Conversation" c
    JOIN "Message" m ON m."conversationId" = c.id AND m.role = 'user'
    WHERE c."organizationId" = ${org.id}
      AND c."resolvedAt" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Escalation" e WHERE e."conversationId" = c.id)
    ORDER BY c.id, m."createdAt" ASC
  `;

  const covered: number[] = [];
  const questions = [...new Set(resolved.map((r) => r.question))];
  const questionVectors = await embeddingProvider.embed(questions);
  for (const vector of questionVectors) {
    const literal = `[${vector.join(",")}]`;
    const rows = await prisma.$queryRaw<{ similarity: number }[]>`
      SELECT (1 - (ch.embedding <=> ${literal}::vector))::float AS similarity
      FROM "Chunk" ch JOIN "Source" s ON s.id = ch."sourceId"
      WHERE ch.embedding IS NOT NULL AND s."organizationId" = ${org.id}
      ORDER BY ch.embedding <=> ${literal}::vector LIMIT 1
    `;
    if (rows[0]?.similarity != null) covered.push(rows[0].similarity);
  }

  console.log(`\nCOVERAGE  (COVERAGE_THRESHOLD: the library has something on this subject above this)`);
  show("covered questions", band(covered));
  show("uncovered questions", band(uncovered.map((r) => r.similarity)));
  recommend("coverage", band(covered), band(uncovered.map((r) => r.similarity)));
  console.log();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
