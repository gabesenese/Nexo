import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { newWidgetKey } from "../src/routes/auth.js";

/**
 * Needs a real Postgres, so it is gated exactly like the isolation suite and
 * refuses any database whose name is not a *_test database.
 */
const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

suite("GET /api/chat/messages", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Membership","Invite","Escalation","Message","Conversation","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
    );
  });

  async function seedThread(sessionId: string) {
    const org = await prisma.organization.create({
      data: { name: "Widget Co", slug: `widget-co-${Date.now()}`, widgetKey: newWidgetKey() },
    });
    const conversation = await prisma.conversation.create({
      data: { organizationId: org.id, sessionId, status: "escalated" },
    });
    return { org, conversation };
  }

  function fetchMessages(widgetKey: string, sessionId: string, query = "") {
    return app.inject({
      method: "GET",
      url: `/api/chat/messages?orgKey=${widgetKey}&sessionId=${sessionId}${query}`,
    });
  }

  /**
   * The row is stamped when its insert runs but only becomes visible when it
   * commits, so an operator reply written alongside an AI answer can commit
   * second while carrying the earlier timestamp. A timestamp cursor would move
   * past it and never ask for it again, leaving the customer waiting on an
   * answer that was already written.
   */
  it("returns a reply that committed late with an earlier timestamp", async () => {
    const { org, conversation } = await seedThread("late-commit");
    const base = Date.now();

    await prisma.message.create({
      data: { conversationId: conversation.id, role: "user", content: "question", createdAt: new Date(base) },
    });
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "assistant", content: "ai answer", createdAt: new Date(base + 2000) },
    });
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "agent", content: "operator reply", createdAt: new Date(base + 1000) },
    });

    const res = await fetchMessages(org.widgetKey, "late-commit");

    expect(res.statusCode).toBe(200);
    expect(res.json().messages.map((m: { content: string }) => m.content)).toContain("operator reply");
  });

  /** Bundles cached on customer sites keep sending the old cursor until they expire. */
  it("ignores a stale after cursor rather than hiding messages behind it", async () => {
    const { org, conversation } = await seedThread("stale-cursor");
    const base = Date.now();

    await prisma.message.create({
      data: { conversationId: conversation.id, role: "assistant", content: "ai answer", createdAt: new Date(base + 2000) },
    });
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "agent", content: "operator reply", createdAt: new Date(base + 1000) },
    });

    const cursor = new Date(base + 2000).toISOString();
    const res = await fetchMessages(org.widgetKey, "stale-cursor", `&after=${encodeURIComponent(cursor)}`);

    expect(res.json().messages.map((m: { content: string }) => m.content)).toContain("operator reply");
  });

  it("returns the whole thread in chronological order", async () => {
    const { org, conversation } = await seedThread("ordering");
    const base = Date.now();

    await prisma.message.create({
      data: { conversationId: conversation.id, role: "user", content: "first", createdAt: new Date(base) },
    });
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "assistant", content: "second", createdAt: new Date(base + 1000) },
    });

    const res = await fetchMessages(org.widgetKey, "ordering");

    expect(res.json().messages.map((m: { content: string }) => m.content)).toEqual(["first", "second"]);
    expect(res.json().status).toBe("escalated");
  });

  it("reports an unknown session as an empty thread rather than an error", async () => {
    const { org } = await seedThread("known");
    const res = await fetchMessages(org.widgetKey, "never-seen");

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ conversationId: null, status: null, messages: [] });
  });

  it("rejects an unknown widget key", async () => {
    const res = await fetchMessages("wk_does_not_exist", "whatever");
    expect(res.statusCode).toBe(404);
  });

  it("does not return another organization's thread for the same session id", async () => {
    const mine = await seedThread("shared-session");
    const theirs = await seedThread("shared-session");
    await prisma.message.create({
      data: { conversationId: theirs.conversation.id, role: "agent", content: "their secret", createdAt: new Date() },
    });

    const res = await fetchMessages(mine.org.widgetKey, "shared-session");

    expect(res.json().messages).toHaveLength(0);
  });
});
