import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth, requirePermission } from "./auth.js";

const PAGE_SIZE = 50;

export async function auditRoutes(app: FastifyInstance) {
  /**
   * Guarded as a settings write rather than a read. The log names who changed
   * what and when, which is exactly the information an account taken over by
   * someone else would use to work out what it can get away with. It belongs
   * to the people who can already change those things.
   */
  app.get<{ Querystring: { before?: string } }>(
    "/api/audit",
    { preHandler: [requireAuth, requirePermission("settings:write")] },
    async (req) => {
      const parsed = z.object({ before: z.string().datetime().optional() }).safeParse(req.query ?? {});
      const before = parsed.success && parsed.data.before ? new Date(parsed.data.before) : undefined;

      const events = await prisma.auditEvent.findMany({
        where: {
          organizationId: req.auth!.organizationId,
          ...(before ? { createdAt: { lt: before } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE + 1,
      });

      const page = events.slice(0, PAGE_SIZE);
      return {
        events: page.map((e) => ({
          id: e.id,
          action: e.action,
          /** Null actor means Nexo acted, or nobody was signed in, as during a password reset. */
          actor: e.actorEmail ? { email: e.actorEmail, name: e.actorName } : null,
          targetType: e.targetType,
          targetLabel: e.targetLabel,
          metadata: e.metadata,
          at: e.createdAt.toISOString(),
        })),
        /** Cursor rather than an offset, so a new event arriving mid-read cannot shift a page. */
        nextBefore: events.length > PAGE_SIZE ? page[page.length - 1].createdAt.toISOString() : null,
      };
    },
  );
}
