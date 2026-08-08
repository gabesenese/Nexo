import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { handleUserMessage } from "../orchestrator/stateMachine.js";

interface ChatBody {
  sessionId: string;
  orgKey: string;
  message: string;
  forceEscalate?: boolean;
}

export async function chatRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { orgKey?: string; sessionId?: string; after?: string } }>(
    "/api/chat/messages",
    async (req, reply) => {
      const { orgKey, sessionId, after } = req.query ?? {};
      if (!orgKey || !sessionId) {
        return reply.status(400).send({ error: "orgKey and sessionId are required" });
      }
      const org = await prisma.organization.findUnique({ where: { slug: orgKey }, select: { id: true } });
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

    const org = await prisma.organization.findUnique({ where: { slug: orgKey }, select: { id: true } });
    if (!org) {
      return reply.status(404).send({ error: "Unknown widget key" });
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
