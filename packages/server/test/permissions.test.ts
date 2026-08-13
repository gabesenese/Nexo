import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";

/**
 * Proves the policy is actually wired to the routes, not merely declared.
 *
 * The unit tests say what each role may do; this says the server agrees. That
 * distinction matters here because the failure this slice fixes was exactly a
 * policy nobody had connected: conversations and sources had no role check at
 * all, so any member could delete every knowledge source a workspace owned.
 */
const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

interface Actor {
  role: Role;
  cookie: string;
}

suite("permissions are enforced by the routes", () => {
  let app: FastifyInstance;
  let organizationId: string;
  let conversationId: string;
  let sourceId: string;
  const actors = new Map<Role, Actor>();

  async function signIn(email: string, password: string): Promise<string> {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
    expect(res.statusCode, `sign in ${email}`).toBe(200);
    const raw = res.headers["set-cookie"];
    return (Array.isArray(raw) ? raw[0] : raw ?? "").split(";")[0];
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false, rateLimits: false });
    await app.ready();

    await prisma.$executeRawUnsafe(
      'TRUNCATE "PasswordResetToken","Membership","Invite","Escalation","Message","Conversation","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
    );

    const org = await prisma.organization.create({
      data: { name: "Perms Co", slug: `perms-${Date.now()}`, widgetKey: `wk_perms_${Date.now()}` },
    });
    organizationId = org.id;

    const passwordHash = await bcrypt.hash("password123", 10);
    for (const role of ["owner", "admin", "agent", "viewer"] as const) {
      const user = await prisma.user.create({
        data: { email: `${role}@perms.test`, name: role, passwordHash },
      });
      await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, role } });
      actors.set(role, { role, cookie: await signIn(`${role}@perms.test`, "password123") });
    }

    const conversation = await prisma.conversation.create({
      data: { organizationId: org.id, sessionId: `perms-${Date.now()}` },
    });
    conversationId = conversation.id;

    const source = await prisma.source.create({
      data: { organizationId: org.id, type: "help_center", name: "Docs", origin: "https://x.test", status: "ready" },
    });
    sourceId = source.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const cookieFor = (role: Role) => actors.get(role)!.cookie;

  /** Every role can read; that is what makes Viewer worth having at all. */
  it.each(["owner", "admin", "agent", "viewer"] as const)("lets %s read the workspace", async (role) => {
    for (const url of ["/api/overview", "/api/conversations", "/api/sources", "/api/org"]) {
      const res = await app.inject({ method: "GET", url, headers: { cookie: cookieFor(role) } });
      expect(res.statusCode, `${role} GET ${url}`).toBe(200);
    }
  });

  it.each(["owner", "admin", "agent"] as const)("lets %s reply to a customer", async (role) => {
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/reply`,
      headers: { cookie: cookieFor(role) },
      payload: { message: `reply from ${role}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("does not let a viewer reply to a customer", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/reply`,
      headers: { cookie: cookieFor("viewer") },
      payload: { message: "should not land" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/viewer/i);
  });

  /**
   * The gap this slice closes. Before the policy existed, sources had no role
   * check, so anyone who could sign in could delete a workspace's knowledge.
   */
  it.each(["agent", "viewer"] as const)("does not let %s touch knowledge sources", async (role) => {
    const remove = await app.inject({
      method: "DELETE",
      url: `/api/sources/${sourceId}`,
      headers: { cookie: cookieFor(role) },
    });
    expect(remove.statusCode, "delete").toBe(403);

    const add = await app.inject({
      method: "POST",
      url: "/api/sources/help-center",
      headers: { cookie: cookieFor(role) },
      payload: { url: "https://example.test/help" },
    });
    expect(add.statusCode, "add").toBe(403);

    expect(await prisma.source.count({ where: { id: sourceId } })).toBe(1);
  });

  it.each(["agent", "viewer"] as const)("does not let %s change workspace settings", async (role) => {
    for (const [method, url, payload] of [
      ["PATCH", "/api/org", { name: "Renamed" }],
      ["PATCH", "/api/widget-config", { accentColor: "#000000", welcomeMessage: "hi" }],
    ] as const) {
      const res = await app.inject({ method, url, headers: { cookie: cookieFor(role) }, payload });
      expect(res.statusCode, `${role} ${method} ${url}`).toBe(403);
    }
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    expect(org.name).toBe("Perms Co");
  });

  it.each(["agent", "viewer"] as const)("does not let %s invite teammates", async (role) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/org/invites",
      headers: { cookie: cookieFor(role) },
      payload: { email: "outsider@perms.test", role: "agent" },
    });
    expect(res.statusCode).toBe(403);
    expect(await prisma.invite.count()).toBe(0);
  });

  it.each(["agent", "viewer"] as const)("does not let %s rotate the widget key", async (role) => {
    const before = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const res = await app.inject({
      method: "POST",
      url: "/api/widget-key/rotate",
      headers: { cookie: cookieFor(role) },
    });
    expect(res.statusCode).toBe(403);
    const after = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    expect(after.widgetKey).toBe(before.widgetKey);
  });

  /**
   * The webhook response carries the HMAC signing secret, so it is guarded as a
   * settings write even though it only reads. Anyone holding that secret can
   * forge escalation deliveries into the customer's helpdesk.
   */
  it.each(["agent", "viewer"] as const)("does not hand %s the webhook signing secret", async (role) => {
    const res = await app.inject({ method: "GET", url: "/api/webhook", headers: { cookie: cookieFor(role) } });
    expect(res.statusCode).toBe(403);
    expect(res.body).not.toContain("secret");
  });

  /**
   * This shipped broken. A bulk edit matched the shared "/api/webhook" path and
   * guarded PUT and DELETE as reads, so any viewer could repoint the handoff at
   * an endpoint they controlled and receive every escalation transcript. The
   * GET was covered and the writes were not, which is why it survived review.
   */
  it.each(["agent", "viewer"] as const)("does not let %s configure or remove the handoff webhook", async (role) => {
    const configure = await app.inject({
      method: "PUT",
      url: "/api/webhook",
      headers: { cookie: cookieFor(role) },
      payload: { url: "https://attacker.example.com/collect" },
    });
    expect(configure.statusCode, "PUT").toBe(403);

    const remove = await app.inject({ method: "DELETE", url: "/api/webhook", headers: { cookie: cookieFor(role) } });
    expect(remove.statusCode, "DELETE").toBe(403);

    expect(await prisma.webhookEndpoint.count({ where: { organizationId } })).toBe(0);
  });

  it("still lets an admin read the webhook settings", async () => {
    const res = await app.inject({ method: "GET", url: "/api/webhook", headers: { cookie: cookieFor("admin") } });
    expect(res.statusCode).toBe(200);
  });

  it("tells the caller which role they have and what it cannot do", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/sources/${sourceId}`,
      headers: { cookie: cookieFor("agent") },
    });
    expect(res.json().error).toContain("agent");
    expect(res.json().error).toMatch(/knowledge sources/i);
  });

  it("reports the caller's role and permissions on the session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: cookieFor("agent") } });
    const body = res.json();
    expect(body.role).toBe("agent");
    expect(body.permissions).toEqual(["workspace:read", "conversations:write"]);
  });
});
