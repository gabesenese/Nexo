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
