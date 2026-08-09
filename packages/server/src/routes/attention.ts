import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAuth } from "./auth.js";

export type AttentionType = "waiting_for_human" | "customer_replied";

export interface AttentionItem {
  conversationId: string;
  sessionId: string;
  type: AttentionType;
  since: string;
  reason: string | null;
  preview: string;
}

const PREVIEW_MAX = 240;
const MESSAGE_WINDOW = 10;
const TYPE_RANK: Record<AttentionType, number> = { waiting_for_human: 0, customer_replied: 1 };

/**
 * An escalation flips from `pending` to `handed_off` the moment an operator
 * replies, so pending is an exact "nobody has answered this customer yet"
 * signal without scanning the transcript for agent messages.
 */
export async function attentionRoutes(app: FastifyInstance) {
  app.get("/api/attention", { preHandler: requireAuth }, async (req) => {
    const conversations = await prisma.conversation.findMany({
      where: { organizationId: req.auth!.organizationId, status: "escalated" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        escalations: { orderBy: { createdAt: "asc" } },
        messages: { orderBy: { createdAt: "desc" }, take: MESSAGE_WINDOW },
      },
    });

    const items: AttentionItem[] = [];

    for (const conversation of conversations) {
      if (conversation.escalations.length === 0) continue;
      const lastMessage = conversation.messages[0];
      const lastUserMessage = conversation.messages.find((m) => m.role === "user");
      const pending = conversation.escalations.find((e) => e.status === "pending");

      if (pending) {
        items.push({
          conversationId: conversation.id,
          sessionId: conversation.sessionId,
          type: "waiting_for_human",
          since: pending.createdAt.toISOString(),
          reason: pending.reason,
          preview: (lastUserMessage?.content || pending.summary).slice(0, PREVIEW_MAX),
        });
        continue;
      }

      if (lastMessage?.role === "user") {
        items.push({
          conversationId: conversation.id,
          sessionId: conversation.sessionId,
          type: "customer_replied",
          since: lastMessage.createdAt.toISOString(),
          reason: null,
          preview: lastMessage.content.slice(0, PREVIEW_MAX),
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
