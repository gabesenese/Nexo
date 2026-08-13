import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAuth, requirePermission } from "./auth.js";

export type AttentionType = "waiting_for_human" | "customer_replied" | "reopened";

export interface AttentionAssignee {
  id: string;
  name: string;
}

export interface AttentionItem {
  conversationId: string;
  sessionId: string;
  type: AttentionType;
  since: string;
  reason: string | null;
  preview: string;
  reopenCount: number;
  assignee: AttentionAssignee | null;
}

const PREVIEW_MAX = 240;
const MESSAGE_WINDOW = 10;
const TYPE_RANK: Record<AttentionType, number> = {
  waiting_for_human: 0,
  customer_replied: 1,
  reopened: 2,
};

/**
 * An escalation flips from `pending` to `handed_off` the moment an operator
 * replies, so pending is an exact "nobody has answered this customer yet"
 * signal without scanning the transcript for agent messages.
 *
 * A reopened conversation stays listed even when the AI answered it, because
 * a customer returning to something the team called resolved is the signal
 * that the resolution did not hold. Resolving it again clears it.
 */
export async function attentionRoutes(app: FastifyInstance) {
  app.get("/api/attention", { preHandler: [requireAuth, requirePermission("workspace:read")] }, async (req) => {
    const conversations = await prisma.conversation.findMany({
      where: {
        organizationId: req.auth!.organizationId,
        OR: [{ status: "escalated" }, { status: "active", reopenCount: { gt: 0 } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        escalations: { orderBy: { createdAt: "asc" } },
        messages: { orderBy: { createdAt: "desc" }, take: MESSAGE_WINDOW },
        assignedUser: { select: { id: true, name: true } },
      },
    });

    const items: AttentionItem[] = [];

    for (const conversation of conversations) {
      const lastMessage = conversation.messages[0];
      const lastUserMessage = conversation.messages.find((m) => m.role === "user");
      const pending = conversation.escalations.find((e) => e.status === "pending");
      const base = {
        conversationId: conversation.id,
        sessionId: conversation.sessionId,
        reopenCount: conversation.reopenCount,
        assignee: conversation.assignedUser
          ? { id: conversation.assignedUser.id, name: conversation.assignedUser.name }
          : null,
      };

      if (pending) {
        items.push({
          ...base,
          type: "waiting_for_human",
          since: pending.createdAt.toISOString(),
          reason: pending.reason,
          preview: (lastUserMessage?.content || pending.summary).slice(0, PREVIEW_MAX),
        });
        continue;
      }

      if (conversation.escalations.length > 0 && lastMessage?.role === "user") {
        items.push({
          ...base,
          type: "customer_replied",
          since: lastMessage.createdAt.toISOString(),
          reason: null,
          preview: lastMessage.content.slice(0, PREVIEW_MAX),
        });
        continue;
      }

      if (conversation.reopenCount > 0 && conversation.lastReopenedAt) {
        items.push({
          ...base,
          type: "reopened",
          since: conversation.lastReopenedAt.toISOString(),
          reason: null,
          preview: (lastUserMessage?.content || "").slice(0, PREVIEW_MAX),
        });
      }
    }

    items.sort((a, b) => {
      const byType = TYPE_RANK[a.type] - TYPE_RANK[b.type];
      if (byType !== 0) return byType;
      return a.since.localeCompare(b.since);
    });

    return items;
  });
}
