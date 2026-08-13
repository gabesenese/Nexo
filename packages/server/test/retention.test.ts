import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { REDACTED, cutoffFor, sweepRetention } from "../src/privacy/retention.js";

const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;
const DAY = 24 * 60 * 60 * 1000;

suite("conversation retention", () => {
  let app: FastifyInstance;
  let organizationId: string;
  let ownerCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false, rateLimits: false, retentionSweeps: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedConversation(ageDays: number, sessionId: string) {
    const at = new Date(Date.now() - ageDays * DAY);
    const conversation = await prisma.conversation.create({
      data: { organizationId, sessionId, createdAt: at, status: "resolved", resolvedAt: at },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: conversation.id, role: "user", content: "my card was charged twice", createdAt: at },
        { conversationId: conversation.id, role: "assistant", content: "here is our refund policy", createdAt: at },
      ],
    });
    await prisma.escalation.create({
      data: {
        conversationId: conversation.id,
        reason: "low_confidence",
        summary: "customer wants a refund",
        question: "my card was charged twice",
        createdAt: at,
      },
    });
    await prisma.note.create({
      data: { conversationId: conversation.id, body: "spoke to billing about this customer", createdAt: at },
    });
    return conversation.id;
  }

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AuditEvent","PasswordResetToken","Membership","Invite","Escalation","Message","Note","Conversation","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
    );
    const org = await prisma.organization.create({
      data: { name: "Privacy Co", slug: `privacy-${Date.now()}`, widgetKey: `wk_p_${Date.now()}` },
    });
    organizationId = org.id;

    const passwordHash = await bcrypt.hash("password123", 10);
    for (const role of ["owner", "viewer"] as const) {
      const user = await prisma.user.create({ data: { email: `${role}@privacy.test`, name: role, passwordHash } });
      await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, role } });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: `${role}@privacy.test`, password: "password123" },
      });
      const raw = login.headers["set-cookie"];
      const cookie = (Array.isArray(raw) ? raw[0] : raw ?? "").split(";")[0];
      if (role === "owner") ownerCookie = cookie;
      else viewerCookie = cookie;
    }
  });

  it("keeps everything when no policy is set", async () => {
    await seedConversation(500, "old");
    const result = await sweepRetention();
    expect(result.conversationsAnonymized).toBe(0);
    const message = await prisma.message.findFirstOrThrow();
    expect(message.content).toBe("my card was charged twice");
  });

  it("strips what the customer said past the window, and leaves the rest alone", async () => {
    const old = await seedConversation(120, "old");
    const recent = await seedConversation(10, "recent");
    await prisma.organization.update({ where: { id: organizationId }, data: { conversationRetentionDays: 90 } });

    const result = await sweepRetention();
    expect(result.conversationsAnonymized).toBe(1);

    for (const m of await prisma.message.findMany({ where: { conversationId: old } })) {
      expect(m.content).toBe(REDACTED);
    }
    const escalation = await prisma.escalation.findFirstOrThrow({ where: { conversationId: old } });
    expect(escalation.question).toBeNull();
    expect(escalation.summary).toBe(REDACTED);
    const note = await prisma.note.findFirstOrThrow({ where: { conversationId: old } });
    expect(note.body).toBe(REDACTED);

    const untouched = await prisma.message.findFirst({ where: { conversationId: recent } });
    expect(untouched?.content).toBe("my card was charged twice");
  });

  /**
   * The design decision worth protecting: deleting the rows would make the
   * Impact page's history shrink every night, so retention removes content and
   * keeps the shell.
   */
  it("keeps the conversation itself so the workspace's own history stays true", async () => {
    const old = await seedConversation(120, "old");
    await prisma.organization.update({ where: { id: organizationId }, data: { conversationRetentionDays: 30 } });
    await sweepRetention();

    const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: old } });
    expect(conversation.status).toBe("resolved");
    expect(conversation.resolvedAt).not.toBeNull();
    expect(conversation.anonymizedAt).not.toBeNull();
    expect(await prisma.conversation.count({ where: { organizationId } })).toBe(1);
  });

  it("clears the question embedding, which would otherwise outlive the question", async () => {
    const old = await seedConversation(120, "old");
    await prisma.$executeRawUnsafe(
      `UPDATE "Escalation" SET "questionEmbedding" = $1::vector WHERE "conversationId" = $2`,
      `[${Array(768).fill(0.1).join(",")}]`,
      old,
    );
    await prisma.organization.update({ where: { id: organizationId }, data: { conversationRetentionDays: 30 } });
    await sweepRetention();

    const rows = await prisma.$queryRaw<{ embedding: string | null }[]>`
      SELECT "questionEmbedding"::text AS embedding FROM "Escalation" WHERE "conversationId" = ${old}
    `;
    expect(rows[0].embedding).toBeNull();
  });

  it("is idempotent and records that it ran", async () => {
    await seedConversation(120, "old");
    await prisma.organization.update({ where: { id: organizationId }, data: { conversationRetentionDays: 30 } });

    expect((await sweepRetention()).conversationsAnonymized).toBe(1);
    expect((await sweepRetention()).conversationsAnonymized).toBe(0);
    expect(await prisma.auditEvent.count({ where: { action: "retention.applied" } })).toBe(1);
  });

  it("applies the policy the moment it is set, rather than at the next sweep", async () => {
    await seedConversation(120, "old");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/privacy",
      headers: { cookie: ownerCookie },
      payload: { conversationRetentionDays: 30 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().conversationsAnonymized).toBe(1);
    expect(await prisma.auditEvent.count({ where: { action: "retention.policy_changed" } })).toBe(1);
  });

  it("refuses a window outside the allowed range", async () => {
    for (const days of [1, 5000]) {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/privacy",
        headers: { cookie: ownerCookie },
        payload: { conversationRetentionDays: days },
      });
      expect(res.statusCode, `${days} days`).toBe(400);
    }
  });

  it("does not reach into another workspace", async () => {
    const other = await prisma.organization.create({
      data: { name: "Other", slug: `o-${Date.now()}`, widgetKey: `wk_o2_${Date.now()}`, conversationRetentionDays: null },
    });
    const at = new Date(Date.now() - 400 * DAY);
    const conversation = await prisma.conversation.create({
      data: { organizationId: other.id, sessionId: "other", createdAt: at },
    });
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "user", content: "untouched", createdAt: at },
    });

    await prisma.organization.update({ where: { id: organizationId }, data: { conversationRetentionDays: 30 } });
    await sweepRetention();

    const message = await prisma.message.findFirstOrThrow({ where: { conversationId: conversation.id } });
    expect(message.content).toBe("untouched");
  });

  it("computes the cutoff from the window", () => {
    const now = new Date("2026-08-13T00:00:00Z");
    expect(cutoffFor(90, now).toISOString()).toBe("2026-05-15T00:00:00.000Z");
  });
});

suite("data export", () => {
  let app: FastifyInstance;
  let ownerCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false, rateLimits: false, retentionSweeps: false });
    await app.ready();

    await prisma.$executeRawUnsafe(
      'TRUNCATE "AuditEvent","Membership","Escalation","Message","Note","Conversation","User","Organization" RESTART IDENTITY CASCADE',
    );
    const org = await prisma.organization.create({
      data: { name: "Export Co", slug: `export-${Date.now()}`, widgetKey: `wk_e_${Date.now()}` },
    });
    const conversation = await prisma.conversation.create({
      data: { organizationId: org.id, sessionId: "s1", status: "resolved" },
    });
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "user", content: "how do I get a refund" },
    });

    const passwordHash = await bcrypt.hash("password123", 10);
    for (const role of ["owner", "viewer"] as const) {
      const user = await prisma.user.create({ data: { email: `${role}@export.test`, name: role, passwordHash } });
      await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, role } });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: `${role}@export.test`, password: "password123" },
      });
      const raw = login.headers["set-cookie"];
      const cookie = (Array.isArray(raw) ? raw[0] : raw ?? "").split(";")[0];
      if (role === "owner") ownerCookie = cookie;
      else viewerCookie = cookie;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("hands the owner every conversation as a downloadable file", async () => {
    const res = await app.inject({ method: "GET", url: "/api/privacy/export", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename=".*export\.json"/);

    const body = res.json();
    expect(body.conversations).toHaveLength(1);
    expect(body.conversations[0].messages[0].content).toBe("how do I get a refund");
  });

  it("records the export, because it is the whole customer history leaving", async () => {
    await app.inject({ method: "GET", url: "/api/privacy/export", headers: { cookie: ownerCookie } });
    expect(await prisma.auditEvent.count({ where: { action: "data.exported" } })).toBeGreaterThan(0);
  });

  it("does not let a viewer export it", async () => {
    const res = await app.inject({ method: "GET", url: "/api/privacy/export", headers: { cookie: viewerCookie } });
    expect(res.statusCode).toBe(403);
  });
});
