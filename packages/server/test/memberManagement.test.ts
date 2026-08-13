import { afterAll, beforeEach, beforeAll, describe, expect, it } from "vitest";
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

suite("member management", () => {
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
      'TRUNCATE "PasswordResetToken","Membership","Invite","Escalation","Message","Conversation","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
    );
    const org = await prisma.organization.create({
      data: { name: "Team Co", slug: `team-${Date.now()}`, widgetKey: `wk_team_${Date.now()}` },
    });
    organizationId = org.id;

    const passwordHash = await bcrypt.hash("password123", 10);
    for (const role of ["owner", "admin", "agent", "viewer"] as const) {
      const user = await prisma.user.create({ data: { email: `${role}@team.test`, name: role, passwordHash } });
      await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, role } });
      ids.set(role, user.id);

      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: `${role}@team.test`, password: "password123" },
      });
      const raw = login.headers["set-cookie"];
      cookies.set(role, (Array.isArray(raw) ? raw[0] : raw ?? "").split(";")[0]);
    }
  });

  const setRole = (caller: Role, target: Role, role: string) =>
    app.inject({
      method: "PATCH",
      url: `/api/org/members/${ids.get(target)}`,
      headers: { cookie: cookies.get(caller)! },
      payload: { role },
    });

  const remove = (caller: Role, target: Role) =>
    app.inject({
      method: "DELETE",
      url: `/api/org/members/${ids.get(target)}`,
      headers: { cookie: cookies.get(caller)! },
    });

  it("lets an owner change a teammate's role", async () => {
    expect((await setRole("owner", "agent", "admin")).statusCode).toBe(200);
    const membership = await prisma.membership.findFirstOrThrow({ where: { userId: ids.get("agent") } });
    expect(membership.role).toBe("admin");
  });

  it("lets an admin manage roles below owner", async () => {
    expect((await setRole("admin", "viewer", "agent")).statusCode).toBe(200);
  });

  /** Otherwise the distinction between admin and owner is a formality anyone can step over. */
  it("does not let an admin promote anyone to owner, including themselves", async () => {
    expect((await setRole("admin", "agent", "owner")).statusCode).toBe(403);
    expect((await setRole("admin", "admin", "owner")).statusCode).toBe(403);
    expect(await prisma.membership.count({ where: { organizationId, role: "owner" } })).toBe(1);
  });

  it("does not let an admin demote or remove an owner", async () => {
    expect((await setRole("admin", "owner", "agent")).statusCode).toBe(403);
    expect((await remove("admin", "owner")).statusCode).toBe(403);
  });

  it.each(["agent", "viewer"] as const)("does not let %s manage members at all", async (role) => {
    expect((await setRole(role, "viewer", "admin")).statusCode).toBe(403);
    expect((await remove(role, "viewer")).statusCode).toBe(403);
  });

  /**
   * The trap this exists for: an owner demoting themselves leaves a workspace
   * nobody can administer, with no way back short of editing the database.
   */
  it("refuses to leave the workspace without an owner", async () => {
    const demote = await setRole("owner", "owner", "viewer");
    expect(demote.statusCode).toBe(400);
    expect(demote.json().error).toMatch(/only owner/i);

    const deleted = await remove("owner", "owner");
    expect(deleted.statusCode).toBe(400);
    expect(await prisma.membership.count({ where: { organizationId, role: "owner" } })).toBe(1);
  });

  it("allows the handover once a second owner exists", async () => {
    expect((await setRole("owner", "admin", "owner")).statusCode).toBe(200);
    expect((await setRole("owner", "owner", "agent")).statusCode).toBe(200);
    expect(await prisma.membership.count({ where: { organizationId, role: "owner" } })).toBe(1);
  });

  /**
   * The unassign is explicit in the handler, not a foreign-key cascade: SET NULL
   * fires on user deletion, and this deletes a membership. Without it a departed
   * teammate owns live conversations in a workspace they cannot open.
   */
  it("removes a teammate without rewriting what they did", async () => {
    const conversation = await prisma.conversation.create({
      data: { organizationId, sessionId: `s-${Date.now()}`, assignedUserId: ids.get("agent") },
    });
    await prisma.note.create({
      data: { conversationId: conversation.id, authorUserId: ids.get("agent")!, body: "looked into this" },
    });

    expect((await remove("owner", "agent")).statusCode).toBe(200);

    const note = await prisma.note.findFirstOrThrow({ where: { conversationId: conversation.id } });
    expect(note.body).toBe("looked into this");
    const after = await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } });
    expect(after.assignedUserId).toBeNull();
  });

  it("does not reach into another workspace", async () => {
    const other = await prisma.organization.create({
      data: { name: "Other Co", slug: `other-${Date.now()}`, widgetKey: `wk_other_${Date.now()}` },
    });
    const outsider = await prisma.user.create({
      data: { email: "outsider@other.test", name: "Outsider", passwordHash: "x" },
    });
    await prisma.membership.create({ data: { userId: outsider.id, organizationId: other.id, role: "owner" } });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/org/members/${outsider.id}`,
      headers: { cookie: cookies.get("owner")! },
      payload: { role: "viewer" },
    });
    expect(res.statusCode).toBe(404);

    const untouched = await prisma.membership.findFirstOrThrow({ where: { userId: outsider.id } });
    expect(untouched.role).toBe("owner");
  });
});
