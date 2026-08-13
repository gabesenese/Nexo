import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAuth, requirePermission } from "./auth.js";

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/api/analytics", { preHandler: [requireAuth, requirePermission("workspace:read")] }, async (req) => {
    const organizationId = req.auth!.organizationId;

    const totalConversations = await prisma.conversation.count({ where: { organizationId } });

    /**
     * Resolved means a person marked it resolved. It used to mean
     * "total minus currently escalated", which counted every in-flight
     * conversation the AI was still mid-answer on as a resolution.
     */
    const resolvedConversations = await prisma.conversation.count({
      where: { organizationId, status: "resolved" },
    });

    /** Currently in a human's hands. */
    const escalatedConversations = await prisma.conversation.count({
      where: { organizationId, status: "escalated" },
    });

    /**
     * Escalation rate is measured on conversations that ever needed a human,
     * not on the ones sitting in `escalated` right now. Using current status
     * made the rate fall every time an operator resolved something, which
     * reads as improvement where none happened.
     */
    const everEscalatedConversations = await prisma.conversation.count({
      where: { organizationId, escalations: { some: {} } },
    });

    const openConversations = await prisma.conversation.count({
      where: { organizationId, status: { in: ["active", "escalated"] } },
    });

    /** Resolutions that did not hold: the customer came back on the same thread. */
    const reopenedConversations = await prisma.conversation.count({
      where: { organizationId, reopenCount: { gt: 0 } },
    });

    const recentEscalations = await prisma.escalation.findMany({
      where: { conversation: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return {
      totalConversations,
      resolvedConversations,
      escalatedConversations,
      everEscalatedConversations,
      openConversations,
      reopenedConversations,
      resolutionRate: totalConversations ? resolvedConversations / totalConversations : 0,
      escalationRate: totalConversations ? everEscalatedConversations / totalConversations : 0,
      recentEscalations,
    };
  });
}
