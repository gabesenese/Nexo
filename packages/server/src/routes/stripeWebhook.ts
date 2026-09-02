import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";
import { stripeClient, stripeEnabled } from "../billing/stripe.js";
import { applySubscription, type AppliedSubscription } from "../billing/subscription.js";
import { recordAudit } from "../audit/record.js";

/**
 * The events that change entitlement, and nothing else. Stripe will happily
 * deliver dozens of types; subscribing to more than is acted on turns the
 * handler into a place where unrelated failures get logged.
 */
const HANDLED = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function stripeWebhookRoutes(app: FastifyInstance) {
  await app.register(async (scope) => {
    /**
     * Signature verification needs the exact bytes Stripe signed, so this scope
     * parses the body as a Buffer instead of JSON. It is registered inside an
     * encapsulated plugin so every other route in the server still receives
     * parsed JSON.
     */
    scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
      done(null, body);
    });

    scope.post("/api/stripe/webhook", async (req, reply) => {
      if (!stripeEnabled() || !env.STRIPE_WEBHOOK_SECRET) {
        return reply.status(503).send({ error: "Billing is not configured." });
      }

      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return reply.status(400).send({ error: "Missing signature." });
      }

      let event: Stripe.Event;
      try {
        event = stripeClient().webhooks.constructEvent(
          req.body as Buffer,
          String(signature),
          env.STRIPE_WEBHOOK_SECRET,
        );
      } catch (err) {
        /**
         * An unverifiable body is either a misconfigured secret or someone
         * trying to grant themselves a plan. Neither should reach the handler.
         */
        return reply
          .status(400)
          .send({ error: `Signature verification failed: ${(err as Error).message}` });
      }

      if (!HANDLED.has(event.type)) {
        return { received: true, ignored: true };
      }

      /**
       * Stripe retries on any non-2xx and can deliver the same event more than
       * once even after a success, so a replay must not reapply the change.
       * The marker is written after the work rather than before: recording it
       * first would mean a crash mid-handler leaves the event marked done and
       * the workspace never updated, which is the failure that silently loses a
       * customer's upgrade.
       */
      const seen = await prisma.processedStripeEvent.findUnique({ where: { id: event.id } });
      if (seen) {
        return { received: true, duplicate: true };
      }

      let outcome: AppliedSubscription | null = null;
      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.subscription) {
              const subscription = await stripeClient().subscriptions.retrieve(
                String(session.subscription),
              );
              /**
               * The retrieve returns the subscription as it is now, not as it
               * stood when the checkout event was created, so the state is
               * stamped with the retrieve time rather than the event's.
               */
              outcome = await applySubscription(subscription, new Date());
            }
            break;
          }
          case "customer.subscription.created":
          case "customer.subscription.updated":
          case "customer.subscription.deleted": {
            outcome = await applySubscription(
              event.data.object as Stripe.Subscription,
              new Date(event.created * 1000),
            );
            break;
          }
        }
      } catch (err) {
        /**
         * Deliberately not recorded as processed, so Stripe's retry picks it up
         * again. A 500 here is the mechanism that makes delivery eventually
         * consistent rather than a lost upgrade.
         */
        req.log.error({ err, eventId: event.id, type: event.type }, "stripe webhook failed");
        return reply.status(500).send({ error: (err as Error).message });
      }

      /**
       * A unique-constraint race with a concurrent redelivery means the other
       * request recorded it first, which is the outcome this wanted anyway.
       */
      await prisma.processedStripeEvent
        .create({ data: { id: event.id, type: event.type } })
        .catch(() => {});

      if (outcome?.applied) {
        await recordAudit(req, {
          organizationId: outcome.organizationId,
          action: "billing.subscription_changed",
          targetType: "subscription",
          targetId: event.id,
          metadata: { type: event.type },
        });
      }

      return outcome && !outcome.applied ? { received: true, stale: true } : { received: true };
    });
  });
}
