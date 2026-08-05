import type { FastifyInstance } from "fastify";
import { handleUserMessage } from "../orchestrator/stateMachine.js";

interface ChatBody {
  sessionId: string;
  message: string;
  forceEscalate?: boolean;
}

export async function chatRoutes(app: FastifyInstance) {
  app.post<{ Body: ChatBody }>("/api/chat", async (req, reply) => {
    const { sessionId, message, forceEscalate } = req.body ?? {};
    if (!sessionId || !message) {
      return reply.status(400).send({ error: "sessionId and message are required" });
    }

    try {
      const result = await handleUserMessage({ sessionId, message, forceEscalate });
      return result;
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}
