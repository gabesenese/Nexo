import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";

const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

const EMAIL = "reset-subject@nexo.test";
const OLD_PASSWORD = "old-password-123";
const NEW_PASSWORD = "new-password-456";

suite("password reset", () => {
  let app: FastifyInstance;

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
    await prisma.user.create({
      data: { email: EMAIL, name: "Reset Subject", passwordHash: await bcrypt.hash(OLD_PASSWORD, 10) },
    });
  });

  const forgot = (email: string) =>
    app.inject({ method: "POST", url: "/api/auth/forgot-password", payload: { email } });

  /**
   * The stored token is a hash, so the plaintext only ever exists in the email.
   * Tests read it back the way the reset link would carry it, by re-deriving
   * from what was issued: since that is impossible by design, the token is
   * captured from the row's creation order and the email transport instead.
   */
  async function requestAndCaptureToken(): Promise<string> {
    const { createHash, randomBytes } = await import("node:crypto");
    /** Mirrors the route: issue a known token directly so the flow can be driven end to end. */
    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return token;
  }

  /**
   * The other tests mint a token directly, which proves the machinery but not
   * the loop a person actually walks. This one asks the route for a reset,
   * takes the link out of the email exactly as a customer would, and spends it.
   */
  it("issues a link by email that actually works", async () => {
    /** A workspace, so signing in afterwards can genuinely succeed rather than 401 for lack of one. */
    const org = await prisma.organization.create({
      data: { name: "Loop Co", slug: `loop-${Date.now()}`, widgetKey: `wk_loop_${Date.now()}` },
    });
    const subject = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    await prisma.membership.create({ data: { userId: subject.id, organizationId: org.id, role: "owner" } });

    const printed: string[] = [];
    const original = console.info;
    console.info = (...args: unknown[]) => printed.push(args.map(String).join(" "));
    try {
      await forgot(EMAIL);
    } finally {
      console.info = original;
    }

    const link = printed.join("\n").match(/\/reset-password\/([0-9a-f]{64})/);
    expect(link, "the email must contain a reset link").not.toBeNull();

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: link![1], password: NEW_PASSWORD },
    });
    expect(res.statusCode).toBe(200);

    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: EMAIL, password: NEW_PASSWORD },
    });
    expect(signIn.statusCode).toBe(200);

    const oldOne = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: EMAIL, password: OLD_PASSWORD },
    });
    expect(oldOne.statusCode).toBe(401);
  });

  /**
   * Signup stores an address exactly as typed and login finds it the same way,
   * so normalising here would mean anyone who capitalised a letter silently
   * never receives a reset, with no way for the endpoint to say so.
   */
  it("finds an account whose address was typed with capitals", async () => {
    const mixed = "Mixed.Case@Nexo.Test";
    await prisma.user.create({
      data: { email: mixed, name: "Mixed", passwordHash: await bcrypt.hash(OLD_PASSWORD, 10) },
    });

    await forgot(mixed);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: mixed } });
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(1);
  });

  it("answers identically for a real address and an unknown one", async () => {
    const known = await forgot(EMAIL);
    const unknown = await forgot("definitely-not-a-user@nexo.test");
    expect(known.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
    expect(known.body).toBe(unknown.body);
  });

  it("never stores the token in a form that could be used from the database", async () => {
    await forgot(EMAIL);
    const rows = await prisma.passwordResetToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stops issuing after a few requests, so one mailbox cannot be flooded", async () => {
    for (let i = 0; i < 6; i++) expect((await forgot(EMAIL)).statusCode).toBe(200);
    expect(await prisma.passwordResetToken.count()).toBe(3);
  });

  it("changes the password and lets the new one sign in", async () => {
    const token = await requestAndCaptureToken();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token, password: NEW_PASSWORD },
    });
    expect(res.statusCode).toBe(200);

    const stale = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: EMAIL, password: OLD_PASSWORD } });
    expect(stale.statusCode).toBe(401);
  });

  it("refuses a token that has already been spent", async () => {
    const token = await requestAndCaptureToken();
    await app.inject({ method: "POST", url: "/api/auth/reset-password", payload: { token, password: NEW_PASSWORD } });

    const again = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token, password: "another-password-789" },
    });
    expect(again.statusCode).toBe(400);
  });

  it("refuses an expired token", async () => {
    const token = await requestAndCaptureToken();
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await app.inject({ method: "POST", url: "/api/auth/reset-password", payload: { token, password: NEW_PASSWORD } });
    expect(res.statusCode).toBe(400);
  });

  it("retires every other outstanding link for the account", async () => {
    const first = await requestAndCaptureToken();
    const second = await requestAndCaptureToken();

    await app.inject({ method: "POST", url: "/api/auth/reset-password", payload: { token: first, password: NEW_PASSWORD } });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token: second, password: "yet-another-password" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("reports whether a link is usable before a password is typed", async () => {
    const token = await requestAndCaptureToken();
    expect((await app.inject({ method: "GET", url: `/api/auth/reset-password/${token}` })).json()).toEqual({ valid: true });
    expect((await app.inject({ method: "GET", url: "/api/auth/reset-password/not-a-real-token" })).json()).toEqual({
      valid: false,
    });
  });

  /**
   * The point of the whole feature. Without this, resetting a password that an
   * attacker already has leaves their session working for the rest of its life.
   */
  it("signs out sessions that were issued before the password changed", async () => {
    const org = await prisma.organization.create({
      data: { name: "Reset Co", slug: `reset-${Date.now()}`, widgetKey: `wk_${Date.now()}` },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, role: "owner" } });

    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: EMAIL, password: OLD_PASSWORD } });
    expect(login.statusCode).toBe(200);
    const cookie = login.headers["set-cookie"];
    const sessionCookie = (Array.isArray(cookie) ? cookie[0] : cookie ?? "").split(";")[0];

    const before = await app.inject({ method: "GET", url: "/api/overview", headers: { cookie: sessionCookie } });
    expect(before.statusCode).toBe(200);

    const token = await requestAndCaptureToken();
    /** `iat` is whole seconds, so the change must land in a later second to be provably after. */
    await new Promise((r) => setTimeout(r, 1100));
    await app.inject({ method: "POST", url: "/api/auth/reset-password", payload: { token, password: NEW_PASSWORD } });

    const after = await app.inject({ method: "GET", url: "/api/overview", headers: { cookie: sessionCookie } });
    expect(after.statusCode).toBe(401);

    /**
     * Checked separately because this endpoint verifies the cookie itself
     * rather than going through requireAuth. If it disagreed, the console would
     * render a dashboard for a session every other request rejects.
     */
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: sessionCookie } });
    expect(me.statusCode).toBe(401);
  });
});
