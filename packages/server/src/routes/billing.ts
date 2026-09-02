import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { BILLING_RETURN_URL } from "../config/env.js";
import { requireAuth, requirePermission } from "./auth.js";
import { priceDetailsFor, priceIdFor, stripeClient, stripeEnabled } from "../billing/stripe.js";
import { accessForOrganization } from "../billing/entitlement.js";
import { recordAudit } from "../audit/record.js";
import { PLANS, type PlanId } from "../config/plans.js";

const planSchema = z.object({ plan: z.enum(["essentials", "professional", "growth"]) });

export async function billingRoutes(app: FastifyInstance) {
  app.get(
    "/api/billing",
    { preHandler: [requireAuth, requirePermission("workspace:read")] },
    async (req) => {
      const organizationId = req.auth!.organizationId;
      const [org, access] = await Promise.all([
        prisma.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: { plan: true, stripeCustomerId: true },
        }),
        accessForOrganization(organizationId),
      ]);

      const plans = await Promise.all(
        Object.values(PLANS).map(async (plan) => ({
          id: plan.id,
          name: plan.name,
          conversationsPerMonth: plan.conversationsPerMonth,
          knowledgeSources: plan.knowledgeSources,
          /** False when this deployment has no price configured for the tier. */
          purchasable: Boolean(priceIdFor(plan.id)),
          price: await priceDetailsFor(plan.id),
        })),
      );

      return {
        /**
         * The console has to distinguish "you cannot pay yet" from "you have not
         * paid". Without this flag an unconfigured deployment renders a checkout
         * button that can only ever return 503.
         */
        enabled: stripeEnabled(),
        plan: org.plan,
        access,
        hasCustomer: Boolean(org.stripeCustomerId),
        plans,
      };
    },
  );

  app.post(
    "/api/billing/checkout",
    { preHandler: [requireAuth, requirePermission("billing:manage")] },
    async (req, reply) => {
      const { userId, organizationId } = req.auth!;

      if (!stripeEnabled()) {
        return reply.status(503).send({ error: "Billing is not configured on this deployment." });
      }

      const parsed = planSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Choose a plan." });
      }

      const plan = parsed.data.plan as PlanId;
      const price = priceIdFor(plan);
      if (!price) {
        return reply
          .status(400)
          .send({ error: `No Stripe price is configured for ${PLANS[plan].name}.` });
      }

      const [org, user] = await Promise.all([
        prisma.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: { id: true, name: true, stripeCustomerId: true },
        }),
        prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } }),
      ]);

      const stripe = stripeClient();

      /**
       * The customer is created once and kept, so a workspace that upgrades,
       * cancels and returns keeps one billing history rather than accumulating
       * a customer per checkout.
       */
      let customerId = org.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: org.name,
          email: user.email,
          metadata: { organizationId: org.id },
        });
        customerId = customer.id;
        await prisma.organization.update({
          where: { id: org.id },
          data: { stripeCustomerId: customerId },
        });
      }

      /**
       * `payment_method_types` is deliberately absent so Stripe offers whatever
       * is eligible for the customer, which is a Dashboard setting rather than
       * something pinned in code.
       *
       * `automatic_tax` is enabled, but it collects nothing until an active tax
       * registration exists for the customer's jurisdiction. That is a Dashboard
       * step this code cannot assert, and forgetting it means GST/HST is quietly
       * not charged on Canadian sales.
       */
      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId,
          line_items: [{ price, quantity: 1 }],
          client_reference_id: org.id,
          subscription_data: { metadata: { organizationId: org.id, plan } },
          automatic_tax: { enabled: true },
          customer_update: { address: "auto" },
          tax_id_collection: { enabled: true },
          success_url: `${BILLING_RETURN_URL}?billing=done`,
          cancel_url: `${BILLING_RETURN_URL}?billing=cancelled`,
        });
      } catch (err) {
        /**
         * Answered deliberately rather than thrown, because the most likely
         * cause is a Stripe account setting rather than a bug: with
         * `automatic_tax` on, a missing head office address rejects every
         * checkout. Left unhandled it reaches the operator as a generic error
         * with no indication that the fix is in the Stripe Dashboard, and the
         * server log is the only place the reason appears.
         */
        req.log.error({ err, plan }, "stripe checkout session creation failed");
        return reply.status(502).send({
          error: `Stripe could not start checkout: ${(err as Error).message}`,
        });
      }

      await recordAudit(req, {
        organizationId,
        action: "billing.checkout_started",
        targetType: "plan",
        targetId: plan,
        targetLabel: PLANS[plan].name,
      });

      return { url: session.url };
    },
  );

  app.post(
    "/api/billing/portal",
    { preHandler: [requireAuth, requirePermission("billing:manage")] },
    async (req, reply) => {
      const { organizationId } = req.auth!;

      if (!stripeEnabled()) {
        return reply.status(503).send({ error: "Billing is not configured on this deployment." });
      }

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { stripeCustomerId: true },
      });

      /**
       * The portal is Stripe's own surface for cards, invoices and cancellation.
       * A workspace that has never checked out has no customer to open it for,
       * and Stripe would reject the call, so answer plainly instead.
       */
      if (!org.stripeCustomerId) {
        return reply.status(400).send({ error: "This workspace has no billing account yet." });
      }

      const session = await stripeClient().billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: BILLING_RETURN_URL,
      });

      return { url: session.url };
    },
  );
}
