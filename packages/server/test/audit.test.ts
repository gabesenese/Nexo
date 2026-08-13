import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";

const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

suite("audit trail", () => {
  let app: FastifyInstance;
  let organizationId: string;
  const ids = new Map<Role, string>();
  const cookies = new Map<Role, string>();

  beforeAll(async () => {
    app = await buildApp({ logger: false, rateLimits: false, retentionSweeps: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AuditEvent","PasswordResetToken","Membership","Invite","Escalation","Message","Conversation","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
    );
    const org = await prisma.organization.create({
      data: { name: "Audit Co", slug: `audit-${Date.now()}`, widgetKey: `wk_audit_${Date.now()}` },
    });
    organizationId = org.id;

    const passwordHash = await bcrypt.hash("password123", 10);
    for (const role of ["owner", "admin", "agent", "viewer"] as const) {
      const user = await prisma.user.create({ data: { email: `${role}@audit.test`, name: role, passwordHash } });
      await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, role } });
      ids.set(role, user.id);
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: `${role}@audit.test`, password: "password123" },
      });
      const raw = login.headers["set-cookie"];
      cookies.set(role, (Array.isArray(raw) ? raw[0] : raw ?? "").split(";")[0]);
    }
  });

  const events = () => prisma.auditEvent.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } });

  it("records a role change with who, what and the before and after", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/org/members/${ids.get("agent")}`,
      headers: { cookie: cookies.get("owner")! },
      payload: { role: "admin" },
    });

    const [event] = await events();
    expect(event.action).toBe("member.role_changed");
    expect(event.actorEmail).toBe("owner@audit.test");
    expect(event.targetLabel).toBe("agent@audit.test");
    expect(event.metadata).toMatchObject({ from: "agent", to: "admin" });
  });

  it("records the workspace rename with both names", async () => {
    await app.inject({
      method: "PATCH",
      url: "/api/org",
      headers: { cookie: cookies.get("owner")! },
      payload: { name: "Renamed Co" },
    });
    const [event] = await events();
    expect(event.action).toBe("workspace.renamed");
    expect(event.metadata).toMatchObject({ from: "Audit Co", to: "Renamed Co" });
  });

  it("records a knowledge source being removed, naming it after it is gone", async () => {
    const source = await prisma.source.create({
      data: { organizationId, type: "help_center", name: "Refund policy", origin: "https://x.test", status: "ready" },
    });
    await app.inject({
      method: "DELETE",
      url: `/api/sources/${source.id}`,
      headers: { cookie: cookies.get("owner")! },
    });
    const [event] = await events();
    expect(event.action).toBe("knowledge.source_removed");
    expect(event.targetLabel).toBe("Refund policy");
    expect(await prisma.source.count()).toBe(0);
  });

  it("records the widget key rotation", async () => {
    await app.inject({ method: "POST", url: "/api/widget-key/rotate", headers: { cookie: cookies.get("owner")! } });
    expect((await events())[0].action).toBe("widget.key_rotated");
  });

  /**
   * The reason the actor is copied rather than joined: a log is read most often
   * after somebody has left, and one that says "deleted user" then is useless.
   */
  it("still names the actor after their account is removed from the workspace", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/org/members/${ids.get("agent")}`,
      headers: { cookie: cookies.get("admin")! },
      payload: { role: "viewer" },
    });
    await app.inject({
      method: "DELETE",
      url: `/api/org/members/${ids.get("admin")}`,
      headers: { cookie: cookies.get("owner")! },
    });

    const roleChange = (await events()).find((e) => e.action === "member.role_changed");
    expect(roleChange?.actorEmail).toBe("admin@audit.test");
    expect(roleChange?.actorName).toBe("admin");
  });

  it("does not fail the action it is recording", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/org",
      headers: { cookie: cookies.get("owner")! },
      payload: { name: "Still Works" },
    });
    expect(res.statusCode).toBe(200);
  });

  it.each(["agent", "viewer"] as const)("does not let %s read the log", async (role) => {
    const res = await app.inject({ method: "GET", url: "/api/audit", headers: { cookie: cookies.get(role)! } });
    expect(res.statusCode).toBe(403);
  });

  it("returns the log newest first to those who may change things", async () => {
    await app.inject({
      method: "PATCH",
      url: "/api/org",
      headers: { cookie: cookies.get("owner")! },
      payload: { name: "One" },
    });
    await app.inject({
      method: "POST",
      url: "/api/widget-key/rotate",
      headers: { cookie: cookies.get("owner")! },
    });

    const res = await app.inject({ method: "GET", url: "/api/audit", headers: { cookie: cookies.get("admin")! } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.events[0].action).toBe("widget.key_rotated");
    expect(body.events[1].action).toBe("workspace.renamed");
    expect(body.events[0].actor.email).toBe("owner@audit.test");
  });

  it("never shows one workspace's log to another", async () => {
    const other = await prisma.organization.create({
      data: { name: "Other", slug: `o-${Date.now()}`, widgetKey: `wk_o_${Date.now()}` },
    });
    await prisma.auditEvent.create({
      data: { organizationId: other.id, action: "workspace.renamed", actorEmail: "someone@other.test" },
    });

    const res = await app.inject({ method: "GET", url: "/api/audit", headers: { cookie: cookies.get("owner")! } });
    expect(res.json().events).toHaveLength(0);
  });

  /** Nobody is signed in during a reset, so the record names the account instead of an actor. */
  it("records a completed password reset against the account's workspaces", async () => {
    const { createHash, randomBytes } = await import("node:crypto");
    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: ids.get("agent")!,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token, password: "a-brand-new-password" },
    });

    const [event] = await events();
    expect(event.action).toBe("password.reset_completed");
    expect(event.actorEmail).toBeNull();
    expect(event.targetLabel).toBe("agent@audit.test");
  });
});
