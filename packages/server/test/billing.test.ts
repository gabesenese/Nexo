import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Role } from "@prisma/client";
import type Stripe from "stripe";
import bcrypt from "bcryptjs";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/client.js";
import { env } from "../src/config/env.js";
import { applySubscription } from "../src/billing/subscription.js";
import { stripeClient, stripeEnabled } from "../src/billing/stripe.js";

/**
 * The routes that take money, checked against the server rather than in
 * isolation. These run with Stripe unconfigured, which is the state a fresh
 * clone and every CI run is in, so what they prove is that the surface is
 * closed correctly when billing is off and gated correctly by role in every
 * case. Charging a real card is verified separately against Stripe's test mode.
 */
const DB_URL = process.env.DATABASE_URL ?? "";
const RUN = process.env.INTEGRATION === "1";

if (RUN && !/test/i.test(DB_URL)) {
  throw new Error(`Integration tests must run against a *_test database. Refusing DATABASE_URL=${DB_URL}`);
}

const suite = RUN ? describe : describe.skip;

function fakeSubscription(
  id: string,
  status: Stripe.Subscription.Status,
  organizationId: string,
  extra: Record<string, unknown> = {},
): Stripe.Subscription {
  return {
    id,
    status,
    customer: "cus_ordering",
    cancel_at_period_end: false,
    cancel_at: null,
    metadata: { organizationId },
    items: { data: [] },
    ...extra,
  } as unknown as Stripe.Subscription;
}

suite("billing routes", () => {
  let app: FastifyInstance;
  let organizationId: string;
  let orderingOrgId: string;
  const cookies = new Map<Role, string>();

  async function signIn(email: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "password123" },
    });
    expect(res.statusCode, `sign in ${email}`).toBe(200);
    const raw = res.headers["set-cookie"];
    return (Array.isArray(raw) ? raw[0] : (raw ?? "")).split(";")[0];
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false, rateLimits: false, retentionSweeps: false });
    await app.ready();

    await prisma.$executeRawUnsafe(
      'TRUNCATE "ProcessedStripeEvent","PasswordResetToken","Membership","Invite","Escalation","Message","Conversation","Chunk","Source","Lead","User","Organization" RESTART IDENTITY CASCADE',
    );

    const org = await prisma.organization.create({
      data: { name: "Billing Co", slug: `billing-${Date.now()}`, widgetKey: `wk_billing_${Date.now()}` },
    });
    organizationId = org.id;

    const ordering = await prisma.organization.create({
      data: { name: "Ordering Co", slug: `ordering-${Date.now()}`, widgetKey: `wk_ordering_${Date.now()}` },
    });
    orderingOrgId = ordering.id;

    const passwordHash = await bcrypt.hash("password123", 10);
    for (const role of ["owner", "admin", "agent", "viewer"] as const) {
      const user = await prisma.user.create({
        data: { email: `${role}@billing.test`, name: role, passwordHash },
      });
      await prisma.membership.create({ data: { userId: user.id, organizationId, role } });
      cookies.set(role, await signIn(`${role}@billing.test`));
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it("lets any member read the billing summary", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/billing",
      headers: { cookie: cookies.get("viewer")! },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plans).toHaveLength(3);
    expect(body.access.state).toBe("unlimited");
  });

  /**
   * An agent runs the inbox. Spending the workspace's money is a different
   * thing, and it is the reason `billing:manage` exists rather than reusing
   * `settings:write`.
   */
  it("refuses checkout to roles without billing:manage", async () => {
    for (const role of ["agent", "viewer"] as const) {
      const res = await app.inject({
        method: "POST",
        url: "/api/billing/checkout",
        headers: { cookie: cookies.get(role)! },
        payload: { plan: "professional" },
      });
      expect(res.statusCode, `${role} checkout`).toBe(403);
    }
  });

  it("refuses the payment portal to roles without billing:manage", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/billing/portal",
      headers: { cookie: cookies.get("agent")! },
    });
    expect(res.statusCode).toBe(403);
  });

  it("requires a session at all", async () => {
    const res = await app.inject({ method: "POST", url: "/api/billing/checkout", payload: { plan: "growth" } });
    expect(res.statusCode).toBe(401);
  });

  /**
   * Asserts the two halves agree rather than hard-coding one of them, because
   * whether Stripe is configured is a property of the machine running the test,
   * not of the code. CI has no key and exercises the disabled path; a developer
   * with keys in `.env` exercises the other. Pinning `enabled` to false made
   * this fail the moment billing was actually set up locally, which is the one
   * time you least want a red suite.
   *
   * What must hold either way: a deployment that reports it cannot take
   * payments must refuse checkout, and one that reports it can must not refuse
   * for that reason. With keys present the answer is either a Checkout URL or
   * the route's deliberate 502 for an account Stripe rejects (no head office
   * address yet, for instance). A bare 500 is a bug and fails here.
   */
  it("keeps the advertised billing availability consistent with what checkout does", async () => {
    const summary = await app.inject({
      method: "GET",
      url: "/api/billing",
      headers: { cookie: cookies.get("owner")! },
    });
    const enabled: boolean = summary.json().enabled;

    const res = await app.inject({
      method: "POST",
      url: "/api/billing/checkout",
      headers: { cookie: cookies.get("owner")! },
      payload: { plan: "professional" },
    });

    if (enabled) {
      expect([200, 502]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.json().url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
      } else {
        expect(res.json().error).toMatch(/^Stripe could not start checkout: /);
      }
    } else {
      expect(res.statusCode).toBe(503);
    }
  });

  it("rejects an unknown plan before reaching Stripe", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/billing/checkout",
      headers: { cookie: cookies.get("owner")! },
      payload: { plan: "enterprise" },
    });
    expect([400, 503]).toContain(res.statusCode);
  });

  /**
   * The webhook is the one endpoint that can change a workspace's plan, and it
   * is unauthenticated by necessity. An unsigned body must never be acted on.
   */
  it("never acts on an unsigned webhook body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/stripe/webhook",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        id: "evt_forged",
        type: "customer.subscription.updated",
        data: { object: { id: "sub_forged", status: "active", metadata: { organizationId } } },
      }),
    });
    expect([400, 503]).toContain(res.statusCode);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { subscriptionStatus: true, plan: true },
    });
    expect(org.subscriptionStatus).toBe("none");
    expect(org.plan).toBe("essentials");
  });

  /**
   * `/api/plan` is what the console's banners read. If `access` were missing
   * they would silently fall back to the trial clock, which is the bug.
   */
  it("exposes the combined access state on the plan endpoint", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/plan",
      headers: { cookie: cookies.get("owner")! },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.access).toBeDefined();
    expect(body.access.canStartNewConversation).toBe(true);
    expect(body.trial).toBeDefined();
  });

  /**
   * Stripe does not order deliveries. A late `updated` after `deleted` would
   * revive a cancelled workspace, and the previous subscription's `deleted`
   * after its replacement's `created` would cut off a customer who just paid.
   * Both reduce to: an older event must not overwrite newer state.
   */
  it("discards a subscription event older than the state already written", async () => {
    const later = new Date("2026-09-01T12:00:10.000Z");
    const earlier = new Date("2026-09-01T12:00:00.000Z");

    const wrote = await applySubscription(fakeSubscription("sub_order", "canceled", orderingOrgId), later);
    expect(wrote).toEqual({ organizationId: orderingOrgId, applied: true });

    const stale = await applySubscription(fakeSubscription("sub_order", "active", orderingOrgId), earlier);
    expect(stale).toEqual({ organizationId: orderingOrgId, applied: false });

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orderingOrgId },
      select: { subscriptionStatus: true, subscriptionEventAt: true },
    });
    expect(org.subscriptionStatus).toBe("canceled");
    expect(org.subscriptionEventAt).toEqual(later);
  });

  /**
   * Stripe stamps events in whole seconds, so `created` followed by `updated`
   * inside one second share a timestamp. Treating that as stale would strand
   * a new subscription on its `incomplete` state until the next event.
   */
  it("applies an event that shares a second with the state already written", async () => {
    const at = new Date("2026-09-01T12:01:00.000Z");
    await applySubscription(fakeSubscription("sub_tie", "incomplete", orderingOrgId), at);
    const tie = await applySubscription(fakeSubscription("sub_tie", "active", orderingOrgId), at);
    expect(tie?.applied).toBe(true);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orderingOrgId },
      select: { subscriptionStatus: true },
    });
    expect(org.subscriptionStatus).toBe("active");
  });

  /**
   * Found by the first real portal round trip: cancelling there sets `cancel_at`
   * to the period end and leaves `cancel_at_period_end` false, so a workspace
   * whose plan was ending looked, in the console, like nothing had changed.
   */
  it("treats a cancel_at scheduled by the portal as a cancellation at period end", async () => {
    const at = new Date("2026-09-01T12:01:30.000Z");
    const periodEnd = Math.floor(new Date("2026-10-01T12:01:30.000Z").getTime() / 1000);
    await applySubscription(
      fakeSubscription("sub_portal_cancel", "active", orderingOrgId, { cancel_at: periodEnd, cancel_at_period_end: false }),
      at,
    );
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orderingOrgId },
      select: { subscriptionStatus: true, cancelAtPeriodEnd: true },
    });
    expect(org.subscriptionStatus).toBe("active");
    expect(org.cancelAtPeriodEnd).toBe(true);
  });

  /**
   * The wiring end to end: a correctly signed but stale event is acknowledged
   * so Stripe stops retrying it, recorded as processed, and changes nothing.
   * Needs a webhook secret, so it runs for a developer with keys and not in CI.
   */
  it.skipIf(!stripeEnabled() || !env.STRIPE_WEBHOOK_SECRET)(
    "answers a stale signed webhook without changing the workspace",
    async () => {
      const later = new Date("2026-09-01T12:02:10.000Z");
      const earlier = new Date("2026-09-01T12:02:00.000Z");
      await applySubscription(fakeSubscription("sub_wire", "canceled", orderingOrgId), later);

      const payload = JSON.stringify({
        id: "evt_stale_wire",
        object: "event",
        type: "customer.subscription.updated",
        created: Math.floor(earlier.getTime() / 1000),
        data: { object: fakeSubscription("sub_wire", "active", orderingOrgId) },
      });
      const signature = stripeClient().webhooks.generateTestHeaderString({
        payload,
        secret: env.STRIPE_WEBHOOK_SECRET!,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/stripe/webhook",
        headers: { "content-type": "application/json", "stripe-signature": signature },
        payload,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ received: true, stale: true });

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: orderingOrgId },
        select: { subscriptionStatus: true, subscriptionEventAt: true },
      });
      expect(org.subscriptionStatus).toBe("canceled");
      expect(org.subscriptionEventAt).toEqual(later);

      const processed = await prisma.processedStripeEvent.findUnique({ where: { id: "evt_stale_wire" } });
      expect(processed?.type).toBe("customer.subscription.updated");
    },
  );
});
