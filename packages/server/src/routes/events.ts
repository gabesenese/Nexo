import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { requireAuth, requirePermission } from "./auth.js";
import { orgChannel, sessionChannel } from "../realtime/bus.js";
import { openEventStream } from "../realtime/sse.js";

/**
 * Both streams carry a change signal rather than the changed records: the
 * client is told which views went stale and refetches through the same REST
 * endpoints it already used. That keeps one serialization path per view
 * instead of two that can drift, and it means a client that missed an event
 * while offline recovers on its next fetch rather than holding a gap forever.
 */
export async function eventsRoutes(app: FastifyInstance) {
  app.get("/api/events", { preHandler: [requireAuth, requirePermission("workspace:read")] }, async (req, reply) => {
    openEventStream(req, reply, orgChannel(req.auth!.organizationId));
  });

  app.get<{ Querystring: { orgKey?: string; sessionId?: string } }>(
    "/api/chat/events",
    async (req, reply) => {
      const { orgKey, sessionId } = req.query ?? {};
      if (!orgKey || !sessionId) {
        return reply.status(400).send({ error: "orgKey and sessionId are required" });
      }
      const org = await prisma.organization.findUnique({
        where: { widgetKey: orgKey },
        select: { id: true },
      });
      if (!org) {
        return reply.status(404).send({ error: "Unknown widget key" });
      }
      openEventStream(req, reply, sessionChannel(org.id, sessionId));
    },
  );
}
