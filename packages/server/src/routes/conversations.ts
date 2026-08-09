import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAuth } from "./auth.js";

export async function conversationsRoutes(app: FastifyInstance) {
  app.get("/api/conversations", { preHandler: requireAuth }, async (req) => {
    const conversations = await prisma.conversation.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { messages: { orderBy: { createdAt: "asc" } }, escalations: true },
    });
    return conversations;
  });

  app.post<{ Params: { id: string }; Body: { message: string } }>(
    "/api/conversations/:id/reply",
    { preHandler: requireAuth },
    async (req, reply) => {
      const content = req.body?.message?.trim();
      if (!content) {
        return reply.status(400).send({ error: "message is required" });
      }

      const conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id, organizationId: req.auth!.organizationId },
      });
      if (!conversation) {
        return reply.status(404).send({ error: "conversation not found" });
      }

      const message = await prisma.message.create({
        data: { conversationId: conversation.id, role: "agent", content, authorUserId: req.auth!.userId },
      });
      await prisma.escalation.updateMany({
        where: { conversationId: conversation.id, status: "pending" },
        data: { status: "handed_off" },
      });

      return message;
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/conversations/:id/resolve",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { count } = await prisma.conversation.updateMany({
        where: { id: req.params.id, organizationId: req.auth!.organizationId },
        data: { status: "resolved", resolvedAt: new Date() },
      });
      if (count === 0) {
        return reply.status(404).send({ error: "conversation not found" });
      }
      return { ok: true };
    },
  );
}
