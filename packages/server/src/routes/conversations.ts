import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth } from "./auth.js";
import { notifyOrg, notifySession } from "../realtime/bus.js";

const assigneeSelect = { select: { id: true, name: true, email: true } };

export async function conversationsRoutes(app: FastifyInstance) {
  app.get("/api/conversations", { preHandler: requireAuth }, async (req) => {
    const conversations = await prisma.conversation.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        escalations: true,
        assignedUser: assigneeSelect,
      },
    });
    return conversations;
  });

  /**
   * Assigning to `null` unassigns. The target must be a member of the caller's
   * organization, otherwise a conversation could be parked on someone who
   * cannot see it.
   */
  app.post<{ Params: { id: string }; Body: { userId: string | null } }>(
    "/api/conversations/:id/assign",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = z.object({ userId: z.string().min(1).nullable() }).safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "userId must be a member id or null" });
      }
      const { organizationId } = req.auth!;
      const { userId } = parsed.data;

      if (userId) {
        const membership = await prisma.membership.findUnique({
          where: { userId_organizationId: { userId, organizationId } },
        });
        if (!membership) {
          return reply.status(400).send({ error: "That person is not a member of this workspace." });
        }
      }

      const conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id, organizationId },
      });
      if (!conversation) {
        return reply.status(404).send({ error: "conversation not found" });
      }

      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { assignedUserId: userId, assignedAt: userId ? new Date() : null },
        include: { assignedUser: assigneeSelect },
      });

      notifyOrg(organizationId, ["conversations", "attention"]);

      return updated;
    },
  );

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

      notifyOrg(req.auth!.organizationId, ["conversations", "attention"]);
      notifySession(req.auth!.organizationId, conversation.sessionId);

      return message;
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/conversations/:id/resolve",
    { preHandler: requireAuth },
    async (req, reply) => {
      const conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id, organizationId: req.auth!.organizationId },
      });
      if (!conversation) {
        return reply.status(404).send({ error: "conversation not found" });
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "resolved", resolvedAt: new Date() },
      });

      notifyOrg(req.auth!.organizationId, ["conversations", "attention"]);
      notifySession(req.auth!.organizationId, conversation.sessionId);

      return { ok: true };
    },
  );
}
