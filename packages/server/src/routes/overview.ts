import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAuth } from "./auth.js";
import { findKnowledgeGaps } from "../knowledge/gaps.js";

/** How many gaps and activity entries the command centre shows before deferring to the full page. */
const KNOWLEDGE_HEALTH_LIMIT = 3;
const ACTIVITY_LIMIT = 6;

export interface ActivityEntry {
  id: string;
  type: "escalated" | "resolved" | "source_indexed";
  summary: string;
  conversationId: string | null;
  at: string;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * One request behind the whole command centre. The page asks "what is
 * happening right now", and answering that from five separate endpoints would
 * show the operator a screen that is internally inconsistent while it fills in.
 *
 * Every figure here is counted from real rows. Nothing is estimated, and any
 * section with nothing behind it returns empty rather than a placeholder.
 */
export async function overviewRoutes(app: FastifyInstance) {
  app.get("/api/overview", { preHandler: requireAuth }, async (req) => {
    const organizationId = req.auth!.organizationId;

    const [
      totalConversations,
      openConversations,
      waitingOnHuman,
      resolvedToday,
      resolvedConversations,
      everEscalatedConversations,
    ] = await Promise.all([
      prisma.conversation.count({ where: { organizationId } }),
      prisma.conversation.count({ where: { organizationId, status: { in: ["active", "escalated"] } } }),
      prisma.conversation.count({
        where: { organizationId, escalations: { some: { status: "pending" } } },
      }),
      prisma.conversation.count({
        where: { organizationId, status: "resolved", resolvedAt: { gte: startOfToday() } },
      }),
      prisma.conversation.count({ where: { organizationId, status: "resolved" } }),
      prisma.conversation.count({ where: { organizationId, escalations: { some: {} } } }),
    ]);

    /**
     * A real activity feed assembled from rows that already exist, rather than
     * a new event table written for the sake of a widget. Escalations and
     * resolutions carry their own timestamps, and a source records when it
     * last finished indexing.
     */
    const [escalations, resolutions, sources] = await Promise.all([
      prisma.escalation.findMany({
        where: { conversation: { organizationId } },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: { id: true, conversationId: true, reason: true, createdAt: true },
      }),
      prisma.conversation.findMany({
        where: { organizationId, resolvedAt: { not: null } },
        orderBy: { resolvedAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: { id: true, resolvedAt: true, messages: { where: { role: "user" }, take: 1, orderBy: { createdAt: "asc" }, select: { content: true } } },
      }),
      prisma.source.findMany({
        where: { organizationId, lastSyncedAt: { not: null } },
        orderBy: { lastSyncedAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: { id: true, name: true, lastSyncedAt: true },
      }),
    ]);

    const activity: ActivityEntry[] = [
      ...escalations.map((e) => ({
        id: `esc-${e.id}`,
        type: "escalated" as const,
        summary:
          e.reason === "user_requested"
            ? "A customer asked for a person"
            : e.reason === "agent_requested"
              ? "An operator flagged a conversation for a human"
              : "Nexo handed a conversation over, it was not confident",
        conversationId: e.conversationId,
        at: e.createdAt.toISOString(),
      })),
      ...resolutions.map((c) => ({
        id: `res-${c.id}`,
        type: "resolved" as const,
        summary: c.messages[0]?.content.trim()
          ? `Resolved: ${c.messages[0].content.trim()}`
          : "A conversation was resolved",
        conversationId: c.id,
        at: c.resolvedAt!.toISOString(),
      })),
      ...sources.map((s) => ({
        id: `src-${s.id}`,
        type: "source_indexed" as const,
        summary: `${s.name} finished indexing`,
        conversationId: null,
        at: s.lastSyncedAt!.toISOString(),
      })),
    ]
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .slice(0, ACTIVITY_LIMIT);

    const gaps = await findKnowledgeGaps(organizationId);

    return {
      counts: {
        open: openConversations,
        waitingOnHuman,
        resolvedToday,
        total: totalConversations,
      },
      rates: {
        /** Null rather than zero when there is nothing to divide, so the page can say so instead of claiming 0%. */
        resolution: totalConversations ? resolvedConversations / totalConversations : null,
        escalation: totalConversations ? everEscalatedConversations / totalConversations : null,
      },
      knowledgeHealth: {
        total: gaps.length,
        uncovered: gaps.filter((g) => !g.coverage.covered).length,
        top: gaps.slice(0, KNOWLEDGE_HEALTH_LIMIT),
      },
      activity,
    };
  });
}
