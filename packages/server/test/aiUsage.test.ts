import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/db/client.js";
import { recordAiUsage } from "../src/billing/aiUsage.js";
import { newWidgetKey } from "../src/routes/auth.js";

const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

const USAGE = { model: "claude-sonnet-5", inputTokens: 900, outputTokens: 60, cacheReadTokens: 0, cacheWriteTokens: 0 };

suite("recordAiUsage", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Membership","Invite","Escalation","Message","Conversation","Notification","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
    );
  });

  async function org() {
    return prisma.organization.create({
      data: { name: "Cost Co", slug: `cost-${Date.now()}`, widgetKey: newWidgetKey() },
    });
  }

  it("stores the token counts against the workspace and conversation", async () => {
    const o = await org();
    const c = await prisma.conversation.create({ data: { organizationId: o.id, sessionId: "s" } });
    await recordAiUsage({ organizationId: o.id, conversationId: c.id, kind: "draft", usage: USAGE });

    const rows = await prisma.aiUsage.findMany({ where: { organizationId: o.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ conversationId: c.id, kind: "draft", inputTokens: 900, outputTokens: 60 });
  });

  it("records nothing when the provider reports no token counts", async () => {
    const o = await org();
    await recordAiUsage({ organizationId: o.id, kind: "answer", usage: undefined });
    expect(await prisma.aiUsage.count()).toBe(0);
  });

  /** Bookkeeping must never be the reason a customer goes unanswered. */
  it("swallows a failure to write instead of throwing into the chat path", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAiUsage({ organizationId: "no-such-workspace", kind: "answer", usage: USAGE }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("keeps the cost of a thread after the thread itself is deleted", async () => {
    const o = await org();
    const c = await prisma.conversation.create({ data: { organizationId: o.id, sessionId: "gone" } });
    await recordAiUsage({ organizationId: o.id, conversationId: c.id, kind: "answer", usage: USAGE });
    await prisma.conversation.delete({ where: { id: c.id } });

    const rows = await prisma.aiUsage.findMany({ where: { organizationId: o.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].conversationId).toBeNull();
  });
});
