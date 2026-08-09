import { prisma } from "../db/client.js";
import { embeddingProvider } from "../ingestion/embeddings.js";

/**
 * Two questions belong to the same gap above this cosine similarity.
 * Measured rather than guessed: with nomic-embed-text, paraphrases of one
 * question score no lower than 0.61, while questions on genuinely different
 * topics peak at 0.52. This sits between them. Raising it splits paraphrases
 * of the same ask; lowering it merges unrelated topics, which is the worse
 * failure because an operator cannot tell a bad merge from a real pattern.
 */
const SIMILARITY_THRESHOLD = 0.57;

/**
 * A customer choosing "talk to a human" is not a documentation failure, so
 * only answers the AI could not stand behind count toward a gap.
 */
const GAP_REASON = "low_confidence";

export interface KnowledgeGap {
  id: string;
  question: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  averageConfidence: number | null;
  unanswered: number;
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
        variants: sorted.slice(0, 8).map((m) => ({
          question: m.question,
          conversationId: m.conversationId,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences || +new Date(b.lastSeen) - +new Date(a.lastSeen));
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
