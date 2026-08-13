import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";

/**
 * Cross-tenant isolation tests (M2c). Gated behind INTEGRATION=1 because they
 * need a real Postgres. Guarded to refuse any database whose name is not a
 * *_test database, so a stray run can never truncate the dev DB.
 */
const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

async function truncateAll() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Membership","Invite","Escalation","Message","Conversation","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
  );
}

suite("tenant isolation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false, rateLimits: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(truncateAll);

  async function signup(email: string, company: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { name: `Owner ${company}`, email, password: "password123", companyName: company },
    });
    expect(res.statusCode).toBe(200);
    const sessionCookie = res.cookies.find((c) => c.name === "nexo_admin_session");
    return {
      cookie: `nexo_admin_session=${sessionCookie!.value}`,
      org: res.json().organization as { id: string; name: string },
    };
  }

  function get(url: string, cookie?: string) {
    return app.inject({ method: "GET", url, headers: cookie ? { cookie } : {} });
  }

  async function seedOrgData(organizationId: string, label: string) {
    await prisma.source.create({
      data: { organizationId, type: "help_center", name: `${label} source`, origin: `https://${label}.example` },
    });
    await prisma.conversation.create({
      data: { organizationId, sessionId: `${label}-sess`, status: "escalated" },
    });
    await prisma.lead.create({
      data: { organizationId, name: `${label} lead`, email: `lead@${label}.example`, company: label },
    });
  }

  it("scopes every dashboard read route to the caller's org", async () => {
    const a = await signup("a@acme.test", "Acme");
    const b = await signup("b@globex.test", "Globex");
    await seedOrgData(a.org.id, "acme");
    await seedOrgData(b.org.id, "globex");

    const aSources = (await get("/api/sources", a.cookie)).json();
    const bSources = (await get("/api/sources", b.cookie)).json();
    expect(aSources.map((s: { name: string }) => s.name)).toEqual(["acme source"]);
    expect(bSources.map((s: { name: string }) => s.name)).toEqual(["globex source"]);

    const aAnalytics = (await get("/api/analytics", a.cookie)).json();
    expect(aAnalytics.totalConversations).toBe(1);
    expect(aAnalytics.escalatedConversations).toBe(1);

    const aConvos = (await get("/api/conversations", a.cookie)).json();
    expect(aConvos).toHaveLength(1);
    expect(aConvos[0].sessionId).toBe("acme-sess");

    const aLeads = (await get("/api/leads", a.cookie)).json();
    expect(aLeads.map((l: { company: string }) => l.company)).toEqual(["acme"]);
  });

  it("never exposes another org's members or settings", async () => {
    const a = await signup("a@acme.test", "Acme");
    const b = await signup("b@globex.test", "Globex");

    const aOrg = (await get("/api/org", a.cookie)).json();
    expect(aOrg.members.map((m: { email: string }) => m.email)).toEqual(["a@acme.test"]);
    expect(aOrg.name).toBe("Acme");

    const bOrg = (await get("/api/org", b.cookie)).json();
    expect(bOrg.members.map((m: { email: string }) => m.email)).toEqual(["b@globex.test"]);
    expect(bOrg.id).not.toBe(aOrg.id);
  });

  it("confines a rename to the caller's own org", async () => {
    const a = await signup("a@acme.test", "Acme");
    const b = await signup("b@globex.test", "Globex");

    const rename = await app.inject({
      method: "PATCH",
      url: "/api/org",
      headers: { cookie: a.cookie, "content-type": "application/json" },
      payload: { name: "Acme Renamed" },
    });
    expect(rename.statusCode).toBe(200);

    expect((await get("/api/org", a.cookie)).json().name).toBe("Acme Renamed");
    expect((await get("/api/org", b.cookie)).json().name).toBe("Globex");
  });

  it("keeps invites private and unrevokable across orgs", async () => {
    const a = await signup("a@acme.test", "Acme");
    const b = await signup("b@globex.test", "Globex");

    const created = await app.inject({
      method: "POST",
      url: "/api/org/invites",
      headers: { cookie: a.cookie, "content-type": "application/json" },
      payload: { email: "invitee@acme.test", role: "agent" },
    });
    expect(created.statusCode).toBe(200);
    const inviteId = created.json().id as string;

    expect((await get("/api/org", b.cookie)).json().invites).toHaveLength(0);

    const bDelete = await app.inject({
      method: "DELETE",
      url: `/api/org/invites/${inviteId}`,
      headers: { cookie: b.cookie },
    });
    expect(bDelete.statusCode).toBe(200);
    expect((await get("/api/org", a.cookie)).json().invites).toHaveLength(1);
  });

  it("enforces owner/admin-only actions against members", async () => {
    const a = await signup("a@acme.test", "Acme");

    const invite = await app.inject({
      method: "POST",
      url: "/api/org/invites",
      headers: { cookie: a.cookie, "content-type": "application/json" },
      payload: { email: "member@acme.test", role: "agent" },
    });
    const token = (await prisma.invite.findUniqueOrThrow({ where: { id: invite.json().id } })).token;

    const accept = await app.inject({
      method: "POST",
      url: `/api/invites/${token}/accept`,
      headers: { "content-type": "application/json" },
      payload: { name: "Member", password: "password123" },
    });
    expect(accept.statusCode).toBe(200);
    const memberCookie = `nexo_admin_session=${accept.cookies.find((c) => c.name === "nexo_admin_session")!.value}`;

    const memberRename = await app.inject({
      method: "PATCH",
      url: "/api/org",
      headers: { cookie: memberCookie, "content-type": "application/json" },
      payload: { name: "Hijacked" },
    });
    expect(memberRename.statusCode).toBe(403);

    const memberInvite = await app.inject({
      method: "POST",
      url: "/api/org/invites",
      headers: { cookie: memberCookie, "content-type": "application/json" },
      payload: { email: "x@acme.test", role: "agent" },
    });
    expect(memberInvite.statusCode).toBe(403);
  });

  it("scopes the public widget chat to a valid org key", async () => {
    const a = await signup("a@acme.test", "Acme");
    const aOrg = (await get("/api/org", a.cookie)).json();

    const missing = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: { "content-type": "application/json" },
      payload: { sessionId: "s1", message: "hi" },
    });
    expect(missing.statusCode).toBe(400);

    const unknown = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: { "content-type": "application/json" },
      payload: { sessionId: "s1", orgKey: `${aOrg.slug}-not-real`, message: "hi" },
    });
    expect(unknown.statusCode).toBe(404);
  });

  it("scopes operator reply and resolve to the caller's org", async () => {
    const a = await signup("a@acme.test", "Acme");
    const b = await signup("b@globex.test", "Globex");
    const convo = await prisma.conversation.create({
      data: { organizationId: a.org.id, sessionId: "acme-c1", status: "escalated" },
    });

    const bReply = await app.inject({
      method: "POST",
      url: `/api/conversations/${convo.id}/reply`,
      headers: { cookie: b.cookie, "content-type": "application/json" },
      payload: { message: "sneaky" },
    });
    expect(bReply.statusCode).toBe(404);

    const bResolve = await app.inject({
      method: "POST",
      url: `/api/conversations/${convo.id}/resolve`,
      headers: { cookie: b.cookie },
    });
    expect(bResolve.statusCode).toBe(404);

    const bDraft = await app.inject({
      method: "POST",
      url: `/api/conversations/${convo.id}/draft`,
      headers: { cookie: b.cookie },
    });
    expect(bDraft.statusCode).toBe(404);

    const aReply = await app.inject({
      method: "POST",
      url: `/api/conversations/${convo.id}/reply`,
      headers: { cookie: a.cookie, "content-type": "application/json" },
      payload: { message: "Hi, I can help with that." },
    });
    expect(aReply.statusCode).toBe(200);
    expect(aReply.json().role).toBe("agent");

    const aResolve = await app.inject({
      method: "POST",
      url: `/api/conversations/${convo.id}/resolve`,
      headers: { cookie: a.cookie },
    });
    expect(aResolve.statusCode).toBe(200);
    expect((await prisma.conversation.findUnique({ where: { id: convo.id } }))?.status).toBe("resolved");
  });

  it("scopes widget config per org and gates writes to owner/admin", async () => {
    const a = await signup("a@acme.test", "Acme");
    const b = await signup("b@globex.test", "Globex");

    const patchA = await app.inject({
      method: "PATCH",
      url: "/api/widget-config",
      headers: { cookie: a.cookie, "content-type": "application/json" },
      payload: { accentColor: "#2b3f8a", welcomeMessage: "Welcome to Acme" },
    });
    expect(patchA.statusCode).toBe(200);

    // B's config is independent of A's write
    expect((await get("/api/widget-config", b.cookie)).json().welcomeMessage).not.toBe("Welcome to Acme");

    // public config by A's slug reflects A's settings
    const aOrg = (await get("/api/org", a.cookie)).json();
    const pub = await app.inject({ method: "GET", url: `/api/widget/config?orgKey=${aOrg.widgetKey}` });
    expect(pub.json()).toMatchObject({ accentColor: "#2b3f8a", welcomeMessage: "Welcome to Acme" });

    // a member cannot change widget settings
    const invite = await app.inject({
      method: "POST",
      url: "/api/org/invites",
      headers: { cookie: a.cookie, "content-type": "application/json" },
      payload: { email: "m@acme.test", role: "agent" },
    });
    const token = (await prisma.invite.findUniqueOrThrow({ where: { id: invite.json().id } })).token;
    const accept = await app.inject({
      method: "POST",
      url: `/api/invites/${token}/accept`,
      headers: { "content-type": "application/json" },
      payload: { name: "M", password: "password123" },
    });
    const memberCookie = `nexo_admin_session=${accept.cookies.find((c) => c.name === "nexo_admin_session")!.value}`;
    const memberPatch = await app.inject({
      method: "PATCH",
      url: "/api/widget-config",
      headers: { cookie: memberCookie, "content-type": "application/json" },
      payload: { accentColor: "#204c40", welcomeMessage: "hijack" },
    });
    expect(memberPatch.statusCode).toBe(403);
  });

  it("rotates the widget key: old key stops resolving, new one works, member gated", async () => {
    const a = await signup("a@acme.test", "Acme");
    const before = (await get("/api/org", a.cookie)).json().widgetKey as string;
    expect((await app.inject({ method: "GET", url: `/api/widget/config?orgKey=${before}` })).statusCode).toBe(200);

    const rot = await app.inject({ method: "POST", url: "/api/widget-key/rotate", headers: { cookie: a.cookie } });
    expect(rot.statusCode).toBe(200);
    const after = rot.json().widgetKey as string;
    expect(after).not.toBe(before);

    expect((await app.inject({ method: "GET", url: `/api/widget/config?orgKey=${before}` })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `/api/widget/config?orgKey=${after}` })).statusCode).toBe(200);

    const invite = await app.inject({
      method: "POST",
      url: "/api/org/invites",
      headers: { cookie: a.cookie, "content-type": "application/json" },
      payload: { email: "m@acme.test", role: "agent" },
    });
    const token = (await prisma.invite.findUniqueOrThrow({ where: { id: invite.json().id } })).token;
    const accept = await app.inject({
      method: "POST",
      url: `/api/invites/${token}/accept`,
      headers: { "content-type": "application/json" },
      payload: { name: "M", password: "password123" },
    });
    const memberCookie = `nexo_admin_session=${accept.cookies.find((c) => c.name === "nexo_admin_session")!.value}`;
    expect(
      (await app.inject({ method: "POST", url: "/api/widget-key/rotate", headers: { cookie: memberCookie } })).statusCode,
    ).toBe(403);
  });

  it("serves the widget bundle route and reflects any origin for embedding", async () => {
    const widget = await app.inject({ method: "GET", url: "/widget.js" });
    expect(widget.headers["content-type"]).toContain("javascript");

    const cors = await app.inject({ method: "GET", url: "/health", headers: { origin: "https://a-customer-site.example" } });
    expect(cors.headers["access-control-allow-origin"]).toBe("https://a-customer-site.example");
  });

  it("rejects unauthenticated access to scoped routes", async () => {
    for (const url of ["/api/sources", "/api/analytics", "/api/conversations", "/api/leads", "/api/org"]) {
      expect((await get(url)).statusCode).toBe(401);
    }
  });
});
