import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth, requirePermission } from "./auth.js";

const DEFAULT_WINDOW_DAYS = 30;

export interface ImpactSummary {
  windowDays: number;
  since: string;
  conversations: number;
  resolvedAutomatically: number;
  resolvedWithHuman: number;
  stillOpen: number;
  escalated: number;
  automationRate: number;
  assumptions: {
    averageHandleMinutes: number | null;
    supportHourlyCostCad: number | null;
  };
  /**
   * Null until the workspace supplies both assumptions. These are the
   * customer's own operating figures applied to counts we measured, never a
   * number Nexo invented, so without them there is nothing honest to show.
   */
  estimated: {
    hoursAvoided: number;
    costAvoidedCad: number;
  } | null;
}

export async function impactRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { days?: string } }>(
    "/api/impact",
    { preHandler: [requireAuth, requirePermission("workspace:read")] },
    async (req): Promise<ImpactSummary> => {
      const organizationId = req.auth!.organizationId;
      const windowDays = clampWindow(req.query?.days);
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
      const scope = { organizationId, createdAt: { gte: since } };

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { averageHandleMinutes: true, supportHourlyCostCad: true },
      });

      const conversations = await prisma.conversation.count({ where: scope });

      /**
       * A human touched it if an agent ever wrote in the thread. Escalation
       * alone does not count: a conversation can sit escalated and unanswered,
       * which is a queue problem rather than human effort spent.
       */
      const resolvedWithHuman = await prisma.conversation.count({
        where: { ...scope, resolvedAt: { not: null }, messages: { some: { role: "agent" } } },
      });

      const resolvedTotal = await prisma.conversation.count({
        where: { ...scope, resolvedAt: { not: null } },
      });

      const escalated = await prisma.conversation.count({
        where: { ...scope, escalations: { some: {} } },
      });

      const resolvedAutomatically = resolvedTotal - resolvedWithHuman;
      const stillOpen = conversations - resolvedTotal;

      const { averageHandleMinutes, supportHourlyCostCad } = org;
      const canEstimate = averageHandleMinutes !== null && supportHourlyCostCad !== null;

      const hoursAvoided = canEstimate ? (resolvedAutomatically * averageHandleMinutes!) / 60 : 0;

      return {
        windowDays,
        since: since.toISOString(),
        conversations,
        resolvedAutomatically,
        resolvedWithHuman,
        stillOpen,
        escalated,
        automationRate: conversations ? resolvedAutomatically / conversations : 0,
        assumptions: { averageHandleMinutes, supportHourlyCostCad },
        estimated: canEstimate
          ? {
              hoursAvoided: round(hoursAvoided, 1),
              costAvoidedCad: round(hoursAvoided * supportHourlyCostCad!, 2),
            }
          : null,
      };
    },
  );

  app.patch("/api/impact/assumptions", { preHandler: [requireAuth, requirePermission("settings:write")] }, async (req, reply) => {
    const { userId, organizationId } = req.auth!;

    const parsed = z
      .object({
        averageHandleMinutes: z.number().int().positive().max(600).nullable(),
        supportHourlyCostCad: z.number().positive().max(10000).nullable(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Average handle time must be 1 to 600 minutes and hourly cost a positive amount.",
      });
    }

    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: parsed.data,
      select: { averageHandleMinutes: true, supportHourlyCostCad: true },
    });
    return org;
  });
}

function clampWindow(raw: string | undefined) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_WINDOW_DAYS;
  return Math.min(Math.max(Math.trunc(parsed), 1), 365);
}

function round(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
