import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth, requirePermission } from "./auth.js";
import { recordAudit } from "../audit/record.js";
import { sweepOrganization } from "../privacy/retention.js";

/** A year and a bit, which covers an annual review cycle without being unbounded. */
const MAX_RETENTION_DAYS = 400;
const MIN_RETENTION_DAYS = 7;

export async function privacyRoutes(app: FastifyInstance) {
  app.get("/api/privacy", { preHandler: [requireAuth, requirePermission("settings:write")] }, async (req) => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: req.auth!.organizationId },
      select: { conversationRetentionDays: true },
    });
    const anonymized = await prisma.conversation.count({
      where: { organizationId: req.auth!.organizationId, anonymizedAt: { not: null } },
    });
    return { conversationRetentionDays: org.conversationRetentionDays, anonymizedConversations: anonymized };
  });

  /**
   * Setting a policy applies it immediately rather than waiting for the next
   * sweep. An operator who has just promised a customer that data older than 90
   * days is gone should not have to wonder whether it is gone yet.
   */
  app.patch("/api/privacy", { preHandler: [requireAuth, requirePermission("settings:write")] }, async (req, reply) => {
    const organizationId = req.auth!.organizationId;
    const parsed = z
      .object({
        conversationRetentionDays: z
          .number()
          .int()
          .min(MIN_RETENTION_DAYS)
          .max(MAX_RETENTION_DAYS)
          .nullable(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: `Choose between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS} days, or turn the policy off.`,
      });
    }

    const before = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { conversationRetentionDays: true },
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data: { conversationRetentionDays: parsed.data.conversationRetentionDays },
    });

    const applied = await sweepOrganization(organizationId);

    await recordAudit(req, {
      organizationId,
      action: "retention.policy_changed",
      targetType: "organization",
      targetId: organizationId,
      metadata: {
        from: before.conversationRetentionDays,
        to: parsed.data.conversationRetentionDays,
        conversationsAnonymized: applied,
      },
    });

    return { conversationRetentionDays: parsed.data.conversationRetentionDays, conversationsAnonymized: applied };
  });

  /**
   * Everything the workspace holds about its customers, in one file.
   *
   * Guarded as a settings write because it is the entire conversation history in
   * a single response: the most concentrated form customer data takes anywhere
   * in Nexo. Streaming and pagination are deliberately absent for now, since a
   * workspace at the current plan ceiling exports in one pass; that stops being
   * true long before it stops being correct.
   */
  app.get("/api/privacy/export", { preHandler: [requireAuth, requirePermission("settings:write")] }, async (req, reply) => {
    const organizationId = req.auth!.organizationId;
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true, slug: true, conversationRetentionDays: true },
    });

    const conversations = await prisma.conversation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        escalations: true,
        notes: { orderBy: { createdAt: "asc" } },
        assignedUser: { select: { email: true, name: true } },
      },
    });

    await recordAudit(req, {
      organizationId,
      action: "data.exported",
      targetType: "organization",
      targetId: organizationId,
      metadata: { conversations: conversations.length },
    });

    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="nexo-${org.slug}-export.json"`);
    return {
      workspace: { name: org.name, slug: org.slug },
      exportedAt: new Date().toISOString(),
      conversationRetentionDays: org.conversationRetentionDays,
      conversations: conversations.map((c) => ({
        id: c.id,
        status: c.status,
        channel: c.channel,
        startedAt: c.createdAt.toISOString(),
        resolvedAt: c.resolvedAt?.toISOString() ?? null,
        reopenCount: c.reopenCount,
        /** Stated rather than implied, so a reader knows why a thread reads as blank. */
        anonymizedAt: c.anonymizedAt?.toISOString() ?? null,
        assignedTo: c.assignedUser?.email ?? null,
        messages: c.messages.map((m) => ({
          role: m.role,
          content: m.content,
          confidence: m.confidence,
          at: m.createdAt.toISOString(),
        })),
        escalations: c.escalations.map((e) => ({
          reason: e.reason,
          summary: e.summary,
          status: e.status,
          at: e.createdAt.toISOString(),
        })),
        internalNotes: c.notes.map((n) => ({ body: n.body, at: n.createdAt.toISOString() })),
      })),
    };
  });
}
