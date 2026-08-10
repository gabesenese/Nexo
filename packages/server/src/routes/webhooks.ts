import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth, roleOf } from "./auth.js";
import { deliver, newWebhookSecret } from "../handoff/webhookAdapter.js";

const RECENT_DELIVERIES = 10;

/**
 * A webhook target is a server-side request we will make repeatedly on the
 * workspace's behalf, so an internal address would turn the endpoint into a
 * way to probe our own network. Public HTTPS only.
 */
function validateUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "That does not look like a valid URL.";
  }
  if (parsed.protocol !== "https:") return "The endpoint must use https.";

  const host = parsed.hostname.toLowerCase();
  const isLoopback =
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    /^127\./.test(host) ||
    /^0\./.test(host);
  const isPrivate =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host.endsWith(".internal") ||
    host.endsWith(".local");

  if (isLoopback || isPrivate) return "The endpoint must be reachable on the public internet.";
  return null;
}

export async function webhookRoutes(app: FastifyInstance) {
  app.get("/api/webhook", { preHandler: requireAuth }, async (req) => {
    const organizationId = req.auth!.organizationId;
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { organizationId },
      include: { deliveries: { orderBy: { createdAt: "desc" }, take: RECENT_DELIVERIES } },
    });

    if (!endpoint) return { configured: false as const };

    return {
      configured: true as const,
      url: endpoint.url,
      secret: endpoint.secret,
      enabled: endpoint.enabled,
      deliveries: endpoint.deliveries.map((d) => ({
        id: d.id,
        event: d.event,
        status: d.status,
        statusCode: d.statusCode,
        attempts: d.attempts,
        error: d.error,
        durationMs: d.durationMs,
        createdAt: d.createdAt,
      })),
    };
  });

  app.put("/api/webhook", { preHandler: requireAuth }, async (req, reply) => {
    const { userId, organizationId } = req.auth!;
    const role = await roleOf(userId, organizationId);
    if (role !== "owner" && role !== "admin") {
      return reply.status(403).send({ error: "Only owners and admins can change the webhook." });
    }

    const parsed = z
      .object({ url: z.string().trim().min(1), enabled: z.boolean().optional() })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "A webhook URL is required." });
    }

    const invalid = validateUrl(parsed.data.url);
    if (invalid) {
      return reply.status(400).send({ error: invalid });
    }

    const existing = await prisma.webhookEndpoint.findUnique({ where: { organizationId } });
    const endpoint = await prisma.webhookEndpoint.upsert({
      where: { organizationId },
      update: { url: parsed.data.url, enabled: parsed.data.enabled ?? true },
      create: {
        organizationId,
        url: parsed.data.url,
        enabled: parsed.data.enabled ?? true,
        secret: newWebhookSecret(),
      },
    });

    return {
      url: endpoint.url,
      enabled: endpoint.enabled,
      secret: endpoint.secret,
      secretRotated: !existing,
    };
  });

  app.delete("/api/webhook", { preHandler: requireAuth }, async (req, reply) => {
    const { userId, organizationId } = req.auth!;
    const role = await roleOf(userId, organizationId);
    if (role !== "owner" && role !== "admin") {
      return reply.status(403).send({ error: "Only owners and admins can change the webhook." });
    }
    await prisma.webhookEndpoint.deleteMany({ where: { organizationId } });
    return { configured: false };
  });

  /**
   * The test send is awaited, unlike a real handoff. An operator pressing the
   * button is waiting for the answer, and there is no customer behind it.
   */
  app.post("/api/webhook/test", { preHandler: requireAuth }, async (req, reply) => {
    const { userId, organizationId } = req.auth!;
    const role = await roleOf(userId, organizationId);
    if (role !== "owner" && role !== "admin") {
      return reply.status(403).send({ error: "Only owners and admins can change the webhook." });
    }

    const endpoint = await prisma.webhookEndpoint.findUnique({ where: { organizationId } });
    if (!endpoint) {
      return reply.status(400).send({ error: "Configure a webhook URL first." });
    }

    const outcome = await deliver({
      endpointId: endpoint.id,
      url: endpoint.url,
      secret: endpoint.secret,
      event: "webhook.test",
      conversationId: null,
      data: { message: "This is a test event from Nexo." },
    });

    return outcome;
  });
}
