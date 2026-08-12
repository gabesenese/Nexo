import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth } from "./auth.js";
import { notifyOrg, notifySession } from "../realtime/bus.js";

const assigneeSelect = { select: { id: true, name: true, email: true } };
const noteInclude = {
  orderBy: { createdAt: "asc" },
  include: { author: { select: { id: true, name: true } } },
} as const;

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
        notes: noteInclude,
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

  /**
   * Operator-initiated handoff, for a thread Nexo answered without flagging
   * but a person judges needs human hands. Already-escalated conversations are
   * returned unchanged rather than treated as an error, so a double click does
   * not stack duplicate escalations or fire a second notification.
   */
  app.post<{ Params: { id: string }; Body: { note?: string } }>(
    "/api/conversations/:id/escalate",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { organizationId, userId } = req.auth!;
      const conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id, organizationId },
        include: { escalations: true },
      });
      if (!conversation) {
        return reply.status(404).send({ error: "conversation not found" });
      }
      if (conversation.status === "escalated") {
        return { ok: true, alreadyEscalated: true };
      }

      const note = req.body?.note?.trim();
      const summary = note || "An operator flagged this conversation for a human.";

      await prisma.$transaction([
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: "escalated" },
        }),
        prisma.escalation.create({
          data: { conversationId: conversation.id, reason: "agent_requested", summary },
        }),
        prisma.notification.create({
          data: { organizationId, conversationId: conversation.id, type: "escalation", message: summary },
        }),
      ]);

      req.log.info({ conversationId: conversation.id, userId }, "conversation escalated by operator");

      notifyOrg(organizationId, ["conversations", "attention", "notifications"]);
      notifySession(organizationId, conversation.sessionId);

      return { ok: true, alreadyEscalated: false };
    },
  );

  /**
   * Internal notes live in their own table rather than as another message
   * role. The widget reads Message rows, so there is no endpoint through which
   * a note could reach a customer even if one forgot to filter by role.
   */
  app.post<{ Params: { id: string }; Body: { body: string } }>(
    "/api/conversations/:id/notes",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = z.object({ body: z.string().trim().min(1) }).safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "A note needs some text." });
      }
      const { organizationId, userId } = req.auth!;
      const conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id, organizationId },
        select: { id: true },
      });
      if (!conversation) {
        return reply.status(404).send({ error: "conversation not found" });
      }

      const note = await prisma.note.create({
        data: { conversationId: conversation.id, authorUserId: userId, body: parsed.data.body },
        include: { author: { select: { id: true, name: true } } },
      });

      notifyOrg(organizationId, ["conversations"]);

      return note;
    },
  );

  /**
   * Un-resolves a conversation an operator closed too early. Deliberately does
   * not touch `reopenCount` or `lastReopenedAt`: those record a customer coming
   * back after a resolution, which is a recurrence signal the analytics and the
   * attention queue both read. Correcting our own mistake is not a recurrence,
   * and counting it as one would quietly inflate that number.
   */
  app.post<{ Params: { id: string } }>(
    "/api/conversations/:id/reopen",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { organizationId } = req.auth!;
      const conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id, organizationId },
      });
      if (!conversation) {
        return reply.status(404).send({ error: "conversation not found" });
      }
      if (conversation.status !== "resolved") {
        return { ok: true, alreadyOpen: true };
      }

      const stillWaiting = await prisma.escalation.count({
        where: { conversationId: conversation.id, status: "pending" },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: stillWaiting > 0 ? "escalated" : "active", resolvedAt: null },
      });

      notifyOrg(organizationId, ["conversations", "attention"]);
      notifySession(organizationId, conversation.sessionId);

      return { ok: true, alreadyOpen: false };
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
