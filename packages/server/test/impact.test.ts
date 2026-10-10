import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import type { ImpactSummary } from "../src/routes/impact.js";

const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

/** The definition under test is written down in RESOLUTION.md. */
suite("GET /api/impact counts resolutions the way RESOLUTION.md defines them", () => {
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

  async function setup() {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { name: "Owner", email: "owner@impact.test", password: "password123", companyName: "Impact Co" },
    });
    expect(res.statusCode).toBe(200);
    const cookie = `nexo_admin_session=${res.cookies.find((c) => c.name === "nexo_admin_session")!.value}`;
    return { cookie, organizationId: res.json().organization.id as string };
  }

  async function conversation(
    organizationId: string,
    label: string,
    opts: { resolved?: boolean; agentMessage?: boolean; escalated?: boolean; reopened?: boolean },
  ) {
    const c = await prisma.conversation.create({
      data: {
        organizationId,
        sessionId: label,
        // A reopened thread is active again but keeps the timestamp from its earlier resolution.
        status: opts.resolved ? "resolved" : opts.reopened ? "active" : opts.escalated ? "escalated" : "active",
        resolvedAt: opts.resolved || opts.reopened ? new Date() : null,
        messages: {
          create: [
            { role: "user", content: `question ${label}` },
            { role: "assistant", content: "an answer" },
            ...(opts.agentMessage ? [{ role: "agent" as const, content: "a person replied" }] : []),
          ],
        },
        escalations: opts.escalated ? { create: [{ reason: "low_confidence", summary: "handed off" }] } : undefined,
      },
    });
    return c;
  }

  it("puts each conversation in exactly one bucket, and never credits silence or a handoff to Nexo", async () => {
    const { cookie, organizationId } = await setup();

    await conversation(organizationId, "a-ai-resolved", { resolved: true });
    await conversation(organizationId, "b-ai-resolved-too", { resolved: true });
    await conversation(organizationId, "c-person-replied", { resolved: true, agentMessage: true });
    // Handed off, then closed with no reply typed. Nexo did not resolve this one.
    await conversation(organizationId, "d-handed-off-closed", { resolved: true, escalated: true });
    // Answered and left alone: silence is not a resolution.
    await conversation(organizationId, "e-answered-only", {});
    await conversation(organizationId, "f-answered-only", {});
    await conversation(organizationId, "g-waiting", { escalated: true });
    // Resolved, then the customer came back and reopened it.
    await conversation(organizationId, "h-came-back", { reopened: true });

    const res = await app.inject({ method: "GET", url: "/api/impact", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const impact = res.json() as ImpactSummary;

    expect(impact.conversations).toBe(8);
    expect(impact.resolvedAutomatically).toBe(2);
    expect(impact.resolvedWithHuman).toBe(2);
    expect(impact.answeredUnconfirmed).toBe(3);
    expect(impact.waitingOnPerson).toBe(1);

    // Nothing is counted twice or dropped.
    expect(
      impact.resolvedAutomatically + impact.resolvedWithHuman + impact.answeredUnconfirmed + impact.waitingOnPerson,
    ).toBe(impact.conversations);
    expect(impact.stillOpen).toBe(impact.answeredUnconfirmed + impact.waitingOnPerson);

    // The rate is Nexo's resolutions over every conversation, unconfirmed ones included.
    expect(impact.automationRate).toBeCloseTo(2 / 8, 10);
  });

  it("estimates hours avoided from Nexo's resolutions only", async () => {
    const { cookie, organizationId } = await setup();
    await conversation(organizationId, "r1", { resolved: true });
    await conversation(organizationId, "r2", { resolved: true });
    await conversation(organizationId, "unconfirmed", {});
    await conversation(organizationId, "person", { resolved: true, agentMessage: true });

    await app.inject({
      method: "PATCH",
      url: "/api/impact/assumptions",
      headers: { cookie },
      payload: { averageHandleMinutes: 30, supportHourlyCostCad: 40 },
    });

    const impact = (await app.inject({ method: "GET", url: "/api/impact", headers: { cookie } })).json() as ImpactSummary;
    // Two resolutions of 30 minutes each: 1 hour, C$40. The unconfirmed and human-assisted ones add nothing.
    expect(impact.estimated).toEqual({ hoursAvoided: 1, costAvoidedCad: 40 });
  });
});
