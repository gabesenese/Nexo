import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { embeddingProvider } from "../ingestion/embeddings.js";
import { env } from "../config/env.js";

/**
 * Both thresholds below are cosine similarities, and a cosine similarity is
 * only meaningful inside one embedding space. Switching the embedding model
 * invalidates both even though no code changed, which is why they are a table
 * keyed by provider rather than two bare numbers: flipping `AI_PROVIDER` moves
 * the thresholds with it instead of leaving the previous model's values in
 * place. That failure would be silent. Nothing throws, the page simply starts
 * reporting the wrong thing.
 *
 * `similarity` decides that two questions belong to the same gap. Raising it
 * splits paraphrases of one ask into separate gaps; lowering it merges
 * unrelated topics, which is the worse failure because an operator cannot tell
 * a bad merge from a real pattern.
 *
 * `coverage` decides whether the library has anything on the subject at all.
 *
 * `npm run measure:thresholds` reproduces every band below and is what must be
 * run before any of these numbers move. Never carry a value across providers.
 *
 * ollama / nomic-embed-text, measured 2026-08-13 against the demo workspace:
 *   similarity  paraphrases 0.470-0.913 (p05 0.528) · different asks 0.287-0.521 (p95 0.485)
 *   coverage    covered 0.547-0.819 · uncovered 0.427-0.547
 * The coverage bands touch there, so 0.57 reports the occasional covered
 * question as uncovered. Left as measured: the sample is thin and the honest
 * fix is a better signal, not a nudged number.
 *
 * cloud / text-embedding-3-small at 768 dims, measured 2026-08-16 against the
 * same workspace:
 *   similarity  paraphrases 0.419-0.824 (p05 0.442) · different asks 0.085-0.447 (p95 0.349)
 *   coverage    covered 0.483-0.725 (p05 0.483) · uncovered 0.242-0.442 (p95 0.378)
 * Both bands separate cleanly here, so coverage is a better signal after the
 * cutover than before it. Note how far these sit from the ollama pair: 0.57
 * would land above the paraphrase median, shattering every gap into singletons
 * while also reporting documented subjects as undocumented.
 *
 * The cloud pair is n=12 covered and n=10 uncovered, so confirm it with a fresh
 * `measure:thresholds` run after the corpus is actually re-embedded.
 */
export const embeddingThresholds: Record<
  typeof env.AI_PROVIDER,
  { similarity: number; coverage: number }
> = {
  ollama: { similarity: 0.57, coverage: 0.57 },
  cloud: { similarity: 0.396, coverage: 0.431 },
};

/** The pair in force for the configured provider, exported so tooling reports what the code uses. */
export const activeThresholds = embeddingThresholds[env.AI_PROVIDER];

const SIMILARITY_THRESHOLD = activeThresholds.similarity;

/**
 * A customer choosing "talk to a human" is not a documentation failure, so
 * only answers the AI could not stand behind count toward a gap.
 */
const GAP_REASON = "low_confidence";

/** Below this, nothing in the library is on the subject at all. See THRESHOLDS above. */
const COVERAGE_THRESHOLD = activeThresholds.coverage;

/**
 * Whether the library has anything on this subject, which decides what the
 * operator should actually do. Nothing close means the content does not exist
 * and has to be written. Something close means it exists but did not carry the
 * answer, so the fix is to improve that source. Those are different jobs and
 * the page should not blur them.
 */
export interface GapCoverage {
  source: string | null;
  sourceId: string | null;
  similarity: number | null;
  covered: boolean;
}

export interface KnowledgeGap {
  id: string;
  question: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  averageConfidence: number | null;
  unanswered: number;
  coverage: GapCoverage;
  variants: { question: string; conversationId: string; createdAt: string }[];
}

interface GapRow {
  id: string;
  conversationId: string;
  question: string;
  createdAt: Date;
  status: string;
  confidence: number | null;
  embedding: number[] | null;
}

/**
 * Stored at escalation time so grouping never has to re-embed the backlog.
 * A failure here must not block the handoff: a customer waiting on a human
 * matters more than analytics, so the caller logs and moves on.
 */
export async function storeEscalationQuestion(escalationId: string, question: string) {
  const [embedding] = await embeddingProvider.embed([question]);
  const literal = `[${embedding.join(",")}]`;
  await prisma.$executeRaw`
    UPDATE "Escalation"
    SET "questionEmbedding" = ${literal}::vector
    WHERE id = ${escalationId}
  `;
}

function cosineSimilarity(a: number[], b: number[]) {
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

/**
 * Greedy agglomerative grouping. Escalations arrive newest first, and each one
 * either joins the first existing group it is close enough to or starts its
 * own. Exact clustering would be better with volume, but a support backlog is
 * small enough that the simple pass is both fast and easy to reason about.
 */
function groupBySimilarity(rows: GapRow[]): GapRow[][] {
  const groups: { centroid: number[]; members: GapRow[] }[] = [];

  for (const row of rows) {
    if (!row.embedding) continue;

    let best: { group: (typeof groups)[number]; score: number } | null = null;
    for (const group of groups) {
      const score = cosineSimilarity(row.embedding, group.centroid);
      if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
        best = { group, score };
      }
    }

    if (best) {
      best.group.members.push(row);
      const size = best.group.members.length;
      best.group.centroid = best.group.centroid.map(
        (value, i) => value + (row.embedding![i] - value) / size,
      );
    } else {
      groups.push({ centroid: [...row.embedding], members: [row] });
    }
  }

  return groups.map((g) => g.members);
}

export async function findKnowledgeGaps(organizationId: string): Promise<KnowledgeGap[]> {
  const rows = await prisma.$queryRaw<
    { id: string; conversationId: string; question: string; createdAt: Date; status: string; embedding: string | null }[]
  >`
    SELECT e.id, e."conversationId", e.question, e."createdAt", e.status::text AS status,
           e."questionEmbedding"::text AS embedding
    FROM "Escalation" e
    JOIN "Conversation" c ON c.id = e."conversationId"
    WHERE c."organizationId" = ${organizationId}
      AND e.reason = ${GAP_REASON}
      AND e.question IS NOT NULL
      AND e."questionEmbedding" IS NOT NULL
    ORDER BY e."createdAt" DESC
  `;

  if (rows.length === 0) return [];

  const confidenceByConversation = new Map<string, number>();
  const confidences = await prisma.message.findMany({
    where: {
      conversationId: { in: rows.map((r) => r.conversationId) },
      role: "assistant",
      confidence: { not: null },
    },
    select: { conversationId: true, confidence: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  for (const m of confidences) {
    if (!confidenceByConversation.has(m.conversationId) && m.confidence !== null) {
      confidenceByConversation.set(m.conversationId, m.confidence);
    }
  }

  const parsed: GapRow[] = rows.map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    question: r.question,
    createdAt: r.createdAt,
    status: r.status,
    confidence: confidenceByConversation.get(r.conversationId) ?? null,
    embedding: r.embedding ? (JSON.parse(r.embedding) as number[]) : null,
  }));

  const groups = groupBySimilarity(parsed);
  const representatives = groups.map((members) => mostRepresentative(members));
  const coverage = await coverageFor(
    organizationId,
    representatives.map((r) => r.id),
  );

  return groups
    .map((members) => {
      const sorted = [...members].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const scored = members.filter((m) => m.confidence !== null);

      /**
       * The question shown is the one most typical of the group rather than
       * the newest, so the label does not swing every time a variant lands.
       */
      const representative = mostRepresentative(members);

      return {
        id: representative.id,
        question: representative.question,
        occurrences: members.length,
        firstSeen: sorted[sorted.length - 1].createdAt.toISOString(),
        lastSeen: sorted[0].createdAt.toISOString(),
        averageConfidence: scored.length
          ? scored.reduce((sum, m) => sum + (m.confidence ?? 0), 0) / scored.length
          : null,
        unanswered: members.filter((m) => m.status === "pending").length,
        coverage: coverage.get(representative.id) ?? {
          source: null,
          sourceId: null,
          similarity: null,
          covered: false,
        },
        variants: sorted.slice(0, 8).map((m) => ({
          question: m.question,
          conversationId: m.conversationId,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences || +new Date(b.lastSeen) - +new Date(a.lastSeen));
}

/**
 * Nearest indexed chunk to each gap's representative question, reusing the
 * embedding already stored at escalation time so nothing is re-embedded.
 *
 * This deliberately measures raw cosine similarity rather than reusing
 * `hybridSearch`, whose scores are min-max normalised within their own result
 * set: its top hit always scores near 1 regardless of how poor the match is,
 * which makes it useless as an absolute measure of whether anything relevant
 * exists at all.
 */
async function coverageFor(
  organizationId: string,
  escalationIds: string[],
): Promise<Map<string, GapCoverage>> {
  const coverage = new Map<string, GapCoverage>();
  if (escalationIds.length === 0) return coverage;

  const rows = await prisma.$queryRaw<
    { escalationId: string; name: string | null; sourceId: string | null; similarity: number | null }[]
  >`
    SELECT e.id AS "escalationId", n.name, n."sourceId", n.similarity
    FROM "Escalation" e
    LEFT JOIN LATERAL (
      SELECT s.name, s.id AS "sourceId",
             (1 - (c.embedding <=> e."questionEmbedding"))::float AS similarity
      FROM "Chunk" c
      JOIN "Source" s ON s.id = c."sourceId"
      WHERE c.embedding IS NOT NULL AND s."organizationId" = ${organizationId}
      ORDER BY c.embedding <=> e."questionEmbedding"
      LIMIT 1
    ) n ON true
    WHERE e.id IN (${Prisma.join(escalationIds)})
  `;

  for (const row of rows) {
    coverage.set(row.escalationId, {
      source: row.name,
      sourceId: row.sourceId,
      similarity: row.similarity,
      covered: row.similarity !== null && row.similarity >= COVERAGE_THRESHOLD,
    });
  }
  return coverage;
}

function mostRepresentative(members: GapRow[]): GapRow {
  if (members.length === 1) return members[0];

  let best = members[0];
  let bestScore = -Infinity;
  for (const candidate of members) {
    if (!candidate.embedding) continue;
    let score = 0;
    for (const other of members) {
      if (other === candidate || !other.embedding) continue;
      score += cosineSimilarity(candidate.embedding, other.embedding);
    }
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}
