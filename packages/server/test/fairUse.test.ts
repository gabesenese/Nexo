import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { newWidgetKey } from "../src/routes/auth.js";
import { PLANS } from "../src/config/plans.js";
import { fairUseCeiling } from "../src/billing/usage.js";

const generateResponse = vi.fn();

vi.mock("../src/llm/ollama.js", () => ({
  ollamaChatProvider: { generateResponse: (...args: unknown[]) => generateResponse(...args) },
}));

vi.mock("../src/retrieval/search.js", () => ({
  hybridSearch: vi.fn(async () => [
    { id: "c1", sourceId: "s1", sourceName: "Help center", content: "Invoices live under Billing.", headingPath: ["Billing"], score: 1 },
  ]),
}));

const GOOD_ANSWER = {
  answer: "Invoices live under Billing.",
  confidence: 0.95,
  usedSourceIds: ["c1"],
  usage: { model: "claude-sonnet-5", inputTokens: 1200, outputTokens: 80, cacheReadTokens: 0, cacheWriteTokens: 0 },
};

describe("fairUseCeiling", () => {
  it("is the monthly allowance times the multiplier", () => {
    expect(fairUseCeiling(PLANS.essentials, 2)).toBe(3000);
    expect(fairUseCeiling(PLANS.professional, 1.5)).toBe(12000);
  });

  it("never sits below the allowance, so a customer who has not used what they paid for is never cut off", () => {
    expect(fairUseCeiling(PLANS.essentials, 0.2)).toBe(1500);
    expect(fairUseCeiling(PLANS.essentials, 1)).toBe(1500);
  });
});

const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

suite("fair-use ceiling on POST /api/chat", () => {
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
    generateResponse.mockReset();
    generateResponse.mockResolvedValue(GOOD_ANSWER);
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Membership","Invite","Escalation","Message","Conversation","Notification","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
    );
  });

  async function orgWithConversations(count: number) {
    const org = await prisma.organization.create({
      data: { name: "Busy Co", slug: `busy-${Date.now()}-${count}`, widgetKey: newWidgetKey() },
    });
    await prisma.conversation.createMany({
      data: Array.from({ length: count }, (_, i) => ({ organizationId: org.id, sessionId: `bulk-${i}` })),
    });
    return org;
  }

  function chat(orgKey: string, sessionId: string, message: string) {
    return app.inject({ method: "POST", url: "/api/chat", payload: { sessionId, orgKey, message } });
  }

  it("hands a new conversation to a person, without running the AI, once the ceiling is reached", async () => {
    const ceiling = fairUseCeiling(PLANS.essentials, 2);
    const org = await orgWithConversations(ceiling);

    const res = await chat(org.widgetKey, "newcomer", "How do I send an invoice?");

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.escalated).toBe(true);
    expect(body.answer).toMatch(/person on the team/i);
    expect(body.answer).not.toMatch(/plan|upgrade|limit|quota/i);
    expect(generateResponse).not.toHaveBeenCalled();

    const conversation = await prisma.conversation.findFirstOrThrow({
      where: { organizationId: org.id, sessionId: "newcomer" },
      include: { escalations: true },
    });
    expect(conversation.status).toBe("escalated");
    expect(conversation.escalations).toHaveLength(1);
    expect(conversation.escalations[0].reason).toBe("fair_use_limit");

    const notification = await prisma.notification.findFirstOrThrow({ where: { organizationId: org.id } });
    expect(notification.message).toMatch(/fair-use ceiling/i);

    expect(await prisma.aiUsage.count({ where: { organizationId: org.id } })).toBe(0);
  });

  it("keeps answering below the ceiling, and records what the answer cost", async () => {
    const ceiling = fairUseCeiling(PLANS.essentials, 2);
    const org = await orgWithConversations(ceiling - 2);

    const res = await chat(org.widgetKey, "regular", "How do I send an invoice?");

    expect(res.json().escalated).toBe(false);
    expect(generateResponse).toHaveBeenCalledTimes(1);

    const conversation = await prisma.conversation.findFirstOrThrow({ where: { organizationId: org.id, sessionId: "regular" } });
    const rows = await prisma.aiUsage.findMany({ where: { organizationId: org.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      conversationId: conversation.id,
      kind: "answer",
      model: "claude-sonnet-5",
      inputTokens: 1200,
      outputTokens: 80,
    });
  });

  it("never cuts off a conversation that is already under way when the ceiling is passed", async () => {
    const ceiling = fairUseCeiling(PLANS.essentials, 2);
    const org = await orgWithConversations(ceiling - 1);

    const first = await chat(org.widgetKey, "midway", "How do I send an invoice?");
    expect(first.json().escalated).toBe(false);
    // That conversation took the workspace exactly to the ceiling. The next one is handed over...
    expect((await chat(org.widgetKey, "next-in-line", "Another question")).json().escalated).toBe(true);
    // ...but the one already talking carries on with the AI.
    const second = await chat(org.widgetKey, "midway", "And how do I download it?");
    expect(second.json().escalated).toBe(false);
    expect(generateResponse).toHaveBeenCalledTimes(2);
  });

  it("still lets a customer ask for a person by name", async () => {
    const ceiling = fairUseCeiling(PLANS.essentials, 2);
    const org = await orgWithConversations(ceiling);
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { sessionId: "human", orgKey: org.widgetKey, message: "Please connect me to someone", forceEscalate: true },
    });
    expect(res.json().escalated).toBe(true);
    const escalation = await prisma.escalation.findFirstOrThrow({ where: { conversation: { organizationId: org.id } } });
    expect(escalation.reason).toBe("user_requested");
  });
});
