import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth, requirePermission } from "./auth.js";

const DEFAULT_WINDOW_DAYS = 30;

export interface ImpactSummary {
  windowDays: number;
  since: string;
  conversations: number;
  /** Marked resolved, nobody on the team wrote to the customer, and Nexo never handed it off. See RESOLUTION.md. */
  resolvedAutomatically: number;
  /** Marked resolved after a person wrote to the customer or took a handoff. */
  resolvedWithHuman: number;
  /** Nexo answered, never handed off, and nobody has marked it resolved. Not counted as a resolution. */
  answeredUnconfirmed: number;
  /** Handed off and not yet resolved. */
  waitingOnPerson: number;
  /** answeredUnconfirmed + waitingOnPerson, kept so existing readers of this field still work. */
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
       * A person was involved if one wrote in the thread or took a handoff.
       * Both count: a handed-off conversation that an operator closes without
       * typing a reply (the customer drifted away, say) was still not resolved by
       * Nexo, so it must not be credited to it. The definition lives in
       * RESOLUTION.md; keep this and that file saying the same thing.
       */
      const resolvedWithHuman = await prisma.conversation.count({
        where: {
          ...scope,
          status: "resolved",
          OR: [{ messages: { some: { role: "agent" } } }, { escalations: { some: {} } }],
        },
      });

      /**
       * Resolved means resolved now. A customer who writes again within the
       * reopen window reopens the thread, which sets it back to active but leaves
       * `resolvedAt` behind, so counting on that timestamp would keep crediting a
       * resolution that did not hold. Status is what says whether it holds.
       */
      const resolvedTotal = await prisma.conversation.count({
        where: { ...scope, status: "resolved" },
      });

      const escalated = await prisma.conversation.count({
        where: { ...scope, escalations: { some: {} } },
      });

      /**
       * Not resolved is not the same as unresolved trouble. A conversation Nexo
       * answered and nobody closed is "answered, unconfirmed": it may well have
       * helped, but silence is not evidence of that, so it is shown on its own
       * line and never added to the resolved count.
       */
      const answeredUnconfirmed = await prisma.conversation.count({
        where: { ...scope, status: { not: "resolved" }, escalations: { none: {} } },
      });
      const waitingOnPerson = await prisma.conversation.count({
        where: { ...scope, status: { not: "resolved" }, escalations: { some: {} } },
      });

      const resolvedAutomatically = resolvedTotal - resolvedWithHuman;
      const stillOpen = answeredUnconfirmed + waitingOnPerson;

      const { averageHandleMinutes, supportHourlyCostCad } = org;
      const canEstimate = averageHandleMinutes !== null && supportHourlyCostCad !== null;

      const hoursAvoided = canEstimate ? (resolvedAutomatically * averageHandleMinutes!) / 60 : 0;

      return {
        windowDays,
        since: since.toISOString(),
        conversations,
        resolvedAutomatically,
        resolvedWithHuman,
        answeredUnconfirmed,
        waitingOnPerson,
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
