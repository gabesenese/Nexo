import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAuth } from "./auth.js";

export async function notificationsRoutes(app: FastifyInstance) {
  app.get("/api/notifications", { preHandler: requireAuth }, async (req) => {
    return prisma.notification.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  });

  app.post("/api/notifications/read-all", { preHandler: requireAuth }, async (req) => {
    await prisma.notification.updateMany({
      where: { organizationId: req.auth!.organizationId, read: false },
      data: { read: true },
    });
    return { ok: true };
  });
}
