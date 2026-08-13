import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";

/**
 * Throttling is the kind of protection that can be deleted without anything
 * visibly breaking, so it gets a test that fails loudly if the budgets stop
 * being enforced or start sharing a counter.
 *
 * Gated behind INTEGRATION=1 like the other suites, because signup and login
 * reach the database.
 */
const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

const LIMITS = { auth: 3, chat: 4, general: 50 };

suite("rate limiting", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Membership","Invite","Escalation","Message","Conversation","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
    );
    app = await buildApp({ logger: false, rateLimits: LIMITS });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email = "nobody@nexo.test") {
    return app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "definitely-not-the-password" },
      remoteAddress: "203.0.113.10",
    });
  }

  it("throttles credential guessing once the auth budget is spent", async () => {
    const codes: number[] = [];
    for (let i = 0; i < LIMITS.auth + 2; i++) codes.push((await login()).statusCode);

    expect(codes.slice(0, LIMITS.auth).every((c) => c === 401)).toBe(true);
    expect(codes[LIMITS.auth]).toBe(429);
  });

  /**
   * The failure this guards against is subtle: with one shared counter, an
   * operator's ordinary dashboard traffic spends the login budget and locks
   * them out of signing back in.
   */
  it("keeps each budget on its own counter", async () => {
    const chatCodes: number[] = [];
    for (let i = 0; i < LIMITS.chat + 1; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { sessionId: "s", orgKey: "wk_does_not_exist", message: "hi" },
        remoteAddress: "203.0.113.20",
      });
      chatCodes.push(res.statusCode);
    }
    expect(chatCodes[LIMITS.chat]).toBe(429);

    /** The same client has spent its chat budget entirely, and must still be able to sign in. */
    const auth = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "someone@nexo.test", password: "wrong" },
      remoteAddress: "203.0.113.20",
    });
    expect(auth.statusCode).not.toBe(429);
  });

  it("never throttles an event stream, which one operator holds open all day", async () => {
    for (let i = 0; i < LIMITS.general + 10; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/api/chat/events?orgKey=wk_does_not_exist&sessionId=s",
        remoteAddress: "203.0.113.30",
      });
      expect(res.statusCode).not.toBe(429);
    }
  });

  it("gives each client its own budget", async () => {
    for (let i = 0; i < LIMITS.auth + 2; i++) await login();
    const other = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "nobody@nexo.test", password: "wrong" },
      remoteAddress: "198.51.100.7",
    });
    expect(other.statusCode).not.toBe(429);
  });
});
