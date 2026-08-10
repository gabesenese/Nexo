import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { handleUserMessage } from "../orchestrator/stateMachine.js";
import { canStartNewConversation } from "../billing/trial.js";

interface ChatBody {
  sessionId: string;
  orgKey: string;
  message: string;
  forceEscalate?: boolean;
}

const DEFAULT_ACCENT = "#204c40";
const DEFAULT_WELCOME = "Hi! Ask me anything. I'll cite my sources, and you can talk to a human any time.";

export async function chatRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { orgKey?: string } }>("/api/widget/config", async (req, reply) => {
    const { orgKey } = req.query ?? {};
    if (!orgKey) {
      return reply.status(400).send({ error: "orgKey is required" });
    }
    const org = await prisma.organization.findUnique({
      where: { widgetKey: orgKey },
      include: { widgetConfig: true },
    });
    if (!org) {
      return reply.status(404).send({ error: "Unknown widget key" });
    }
    return {
      organizationName: org.name,
      accentColor: org.widgetConfig?.accentColor ?? DEFAULT_ACCENT,
      welcomeMessage: org.widgetConfig?.welcomeMessage ?? DEFAULT_WELCOME,
    };
  });

  app.get<{ Querystring: { orgKey?: string; sessionId?: string; after?: string } }>(
    "/api/chat/messages",
    async (req, reply) => {
      const { orgKey, sessionId, after } = req.query ?? {};
      if (!orgKey || !sessionId) {
        return reply.status(400).send({ error: "orgKey and sessionId are required" });
      }
      const org = await prisma.organization.findUnique({ where: { widgetKey: orgKey }, select: { id: true } });
      if (!org) {
        return reply.status(404).send({ error: "Unknown widget key" });
      }
      const conversation = await prisma.conversation.findFirst({
        where: { organizationId: org.id, sessionId },
        orderBy: { createdAt: "desc" },
      });
      if (!conversation) {
        return { conversationId: null, status: null, messages: [] };
      }
      const messages = await prisma.message.findMany({
        where: { conversationId: conversation.id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
        orderBy: { createdAt: "asc" },
      });
      return { conversationId: conversation.id, status: conversation.status, messages };
    },
  );

  app.post<{ Body: ChatBody }>("/api/chat", async (req, reply) => {
    const { sessionId, orgKey, message, forceEscalate } = req.body ?? {};
    if (!sessionId || !orgKey || !message) {
      return reply.status(400).send({ error: "sessionId, orgKey, and message are required" });
    }

    const org = await prisma.organization.findUnique({ where: { widgetKey: orgKey }, select: { id: true } });
    if (!org) {
      return reply.status(404).send({ error: "Unknown widget key" });
    }

    /**
     * An expired trial stops new conversations, never one already underway.
     * Cutting someone off mid-question to collect payment would punish the
     * customer's customer for a decision they had no part in.
     */
    const existing = await prisma.conversation.findFirst({
      where: { sessionId, organizationId: org.id, status: { in: ["active", "escalated"] } },
      select: { id: true },
    });
    if (!existing && !(await canStartNewConversation(org.id))) {
      return reply.status(402).send({
        error: "trial_expired",
        message: "This workspace's trial has ended.",
      });
    }

    try {
      const result = await handleUserMessage({ sessionId, organizationId: org.id, message, forceEscalate });
      return result;
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}
