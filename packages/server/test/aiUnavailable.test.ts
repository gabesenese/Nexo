import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { newWidgetKey } from "../src/routes/auth.js";

/**
 * Retrieval embeds the question, so failing it stands in for any provider
 * outage: Ollama not running, a bad API key, the provider down.
 */
vi.mock("../src/retrieval/search.js", () => ({
  hybridSearch: vi.fn(async () => {
    throw new Error("Connection error.");
  }),
}));

/** Needs a real Postgres, gated like the other integration suites. */
const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

suite("POST /api/chat when the AI provider is unavailable", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false, rateLimits: false, retentionSweeps: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Membership","Invite","Escalation","Message","Conversation","Notification","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
    );
  });

  /**
   * The customer's message is stored before the model is called. Throwing
   * afterwards used to leave it on an `active` thread with no answer and no
   * escalation, so nobody was ever told the customer was waiting.
   */
  it("hands the question to a person instead of failing", async () => {
    const org = await prisma.organization.create({
      data: { name: "Widget Co", slug: `widget-co-${Date.now()}`, widgetKey: newWidgetKey() },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { sessionId: "outage", orgKey: org.widgetKey, message: "How do I send an invoice?" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().escalated).toBe(true);

    const conversation = await prisma.conversation.findFirstOrThrow({
      where: { organizationId: org.id, sessionId: "outage" },
      include: { escalations: true, messages: { orderBy: { createdAt: "asc" } } },
    });
    expect(conversation.status).toBe("escalated");
    expect(conversation.escalations).toHaveLength(1);
    expect(conversation.escalations[0].reason).toBe("ai_unavailable");
    expect(conversation.messages.map((m) => m.role)).toEqual(["user", "assistant"]);

    const notifications = await prisma.notification.count({ where: { organizationId: org.id } });
    expect(notifications).toBe(1);
  });
});
