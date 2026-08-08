import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAuth } from "./auth.js";

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/api/analytics", { preHandler: requireAuth }, async (req) => {
    const organizationId = req.auth!.organizationId;
    const totalConversations = await prisma.conversation.count({ where: { organizationId } });
    const escalatedConversations = await prisma.conversation.count({
      where: { organizationId, status: "escalated" },
    });

    /**
     * No explicit "mark resolved" UI yet, so resolution rate is a proxy:
     * any conversation the AI handled without escalating counts as resolved.
     * Revisit once there's an explicit resolution signal (e.g. a CSAT prompt).
     */
    const resolvedConversations = totalConversations - escalatedConversations;

    const recentEscalations = await prisma.escalation.findMany({
      where: { conversation: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return {
      totalConversations,
      resolvedConversations,
      escalatedConversations,
      resolutionRate: totalConversations ? resolvedConversations / totalConversations : 0,
      escalationRate: totalConversations ? escalatedConversations / totalConversations : 0,
      recentEscalations,
    };
  });
}
