import { prisma } from "../db/client.js";

/**
 * Conversation retention, as a lifecycle rather than a settings toggle.
 *
 * A policy that only stores a number is a promise nobody keeps. This one runs:
 * a workspace sets a window, a sweep finds conversations past it, strips what
 * the customer said, and leaves a record that it happened.
 *
 * **Anonymised, not deleted.** Deleting whole conversations would silently
 * rewrite the workspace's own history: the Impact page's hours-saved and the
 * resolution rate are computed from these rows, so a 90-day policy would make
 * last quarter's numbers shrink every night. Retention exists to stop holding
 * what a customer *said*, not to make the business forget it did the work. So
 * the shell survives with its timestamps, status and outcome, and the content
 * goes.
 */

/** What is left in place of a message, so a reader can tell removal from absence. */
export const REDACTED = "[removed by retention policy]";

export interface SweepResult {
  organizationsConsidered: number;
  conversationsAnonymized: number;
}

export function cutoffFor(retentionDays: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

/**
 * Everything that could carry something a customer typed, or that identifies
 * their browser session. Embeddings go too: a question embedding is derived
 * from the question, and keeping it after deleting the text would leave a
 * searchable trace of content the workspace has undertaken not to hold.
 */
async function anonymizeConversations(conversationIds: string[], at: Date): Promise<void> {
  if (conversationIds.length === 0) return;

  await prisma.$transaction([
    prisma.message.updateMany({
      where: { conversationId: { in: conversationIds } },
      data: { content: REDACTED, citations: [] },
    }),
    prisma.note.updateMany({
      where: { conversationId: { in: conversationIds } },
      data: { body: REDACTED },
    }),
    prisma.escalation.updateMany({
      where: { conversationId: { in: conversationIds } },
      data: { question: null, summary: REDACTED, handoffPayload: {} },
    }),
    prisma.conversation.updateMany({
      where: { id: { in: conversationIds } },
      data: { anonymizedAt: at },
    }),
  ]);

  /** questionEmbedding is an unsupported pgvector column, so it is cleared directly. */
  await prisma.$executeRaw`
    UPDATE "Escalation" SET "questionEmbedding" = NULL
    WHERE "conversationId" = ANY(${conversationIds}::text[])
  `;
}

/**
 * Runs every workspace's policy. Conversations already anonymised are skipped,
 * so a repeated sweep costs nothing and the audit record is written once.
 */
export async function sweepRetention(now: Date = new Date()): Promise<SweepResult> {
  const organizations = await prisma.organization.findMany({
    where: { conversationRetentionDays: { not: null } },
    select: { id: true, conversationRetentionDays: true },
  });

  let anonymized = 0;

  for (const org of organizations) {
    const cutoff = cutoffFor(org.conversationRetentionDays!, now);
    const stale = await prisma.conversation.findMany({
      where: { organizationId: org.id, anonymizedAt: null, createdAt: { lt: cutoff } },
      select: { id: true },
    });
    if (stale.length === 0) continue;

    await anonymizeConversations(stale.map((c) => c.id), now);
    anonymized += stale.length;

    /**
     * Written directly rather than through recordAudit, which needs a request:
     * nobody made this happen, the policy did, so the actor is genuinely absent.
     */
    await prisma.auditEvent.create({
      data: {
        organizationId: org.id,
        action: "retention.applied",
        targetType: "conversation",
        metadata: { conversations: stale.length, retentionDays: org.conversationRetentionDays, before: cutoff.toISOString() },
      },
    });
  }

  return { organizationsConsidered: organizations.length, conversationsAnonymized: anonymized };
}

/** Applies one workspace's policy immediately, for the operator who just set one. */
export async function sweepOrganization(organizationId: string, now: Date = new Date()): Promise<number> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { conversationRetentionDays: true },
  });
  if (!org?.conversationRetentionDays) return 0;

  const stale = await prisma.conversation.findMany({
    where: {
      organizationId,
      anonymizedAt: null,
      createdAt: { lt: cutoffFor(org.conversationRetentionDays, now) },
    },
    select: { id: true },
  });
  await anonymizeConversations(stale.map((c) => c.id), now);
  return stale.length;
}

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * In-process, like ingestion and the realtime bus. Fine for one instance and
 * wrong for several, where every instance would sweep: the work is idempotent
 * so the result stays correct, but it needs a single scheduler before Nexo runs
 * more than one process.
 */
export function startRetentionSweeps(): NodeJS.Timeout {
  void sweepRetention().catch(() => {});
  const timer = setInterval(() => {
    void sweepRetention().catch(() => {});
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}
