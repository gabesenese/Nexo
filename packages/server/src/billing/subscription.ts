import type Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../db/client.js";
import { planForPriceId } from "./stripe.js";
import { DEFAULT_PLAN } from "../config/plans.js";

/**
 * Stripe's status vocabulary is wider than this product's. Anything that still
 * entitles the workspace to its plan maps to active or trialing; anything that
 * does not maps to a state that stops entitlement.
 *
 * `unpaid` and `incomplete` both mean the customer is not currently paying, so
 * they map to past_due rather than being left as active. The default arm is
 * deliberately `none` rather than `active`: a status this code has never heard
 * of is a status it cannot claim is paid.
 */
export function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return "none";
  }
}

/**
 * Resolves which workspace a subscription belongs to. The metadata written at
 * checkout is the primary link; the customer lookup is the fallback for a
 * subscription created in the Dashboard by hand, which carries no metadata.
 */
async function organizationIdFor(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.organizationId;
  if (fromMetadata) return fromMetadata;

  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: String(subscription.customer) },
    select: { id: true },
  });
  return org?.id ?? null;
}

export interface AppliedSubscription {
  organizationId: string;
  /** False when newer state was already written and this snapshot was discarded. */
  applied: boolean;
}

/**
 * Writes a Stripe subscription onto the workspace it belongs to. This is the
 * only place entitlement changes, so a plan can only move by something Stripe
 * told us, never by a client asking for it.
 *
 * `observedAt` is when this snapshot of the subscription was true, on Stripe's
 * clock for a webhook event and the retrieve time for a live fetch. Stripe does
 * not order deliveries, so the write is conditional on nothing newer having
 * landed first. Without that, a late `updated` arriving after `deleted` revives
 * a cancelled workspace, and a previous subscription's `deleted` arriving after
 * its replacement's `created` cuts off a customer who has just paid.
 *
 * The comparison admits equal timestamps. Stripe stamps events in whole
 * seconds, so `created` followed by `updated` inside one second share a value,
 * and refusing the second would strand a new subscription on `incomplete`.
 */
export async function applySubscription(
  subscription: Stripe.Subscription,
  observedAt: Date,
): Promise<AppliedSubscription | null> {
  const organizationId = await organizationIdFor(subscription);
  if (!organizationId) return null;

  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  const planFromPrice = priceId ? planForPriceId(priceId) : null;
  const status = mapStatus(subscription.status);

  /**
   * Losing the subscription drops the workspace to the default plan rather than
   * leaving it on a tier it is no longer paying for. Limits then apply again,
   * and knowledge sources already over the cap stay in place: nothing is
   * deleted, the workspace simply cannot add more until it is back under.
   *
   * While the subscription is live but the price is unrecognised, the plan is
   * left alone. That happens when a price exists in Stripe that this deployment
   * has no env var for, and silently downgrading a paying customer because of a
   * missing config value would be worse than leaving them where they are.
   */
  const plan = status === "canceled" || status === "none" ? DEFAULT_PLAN : (planFromPrice ?? undefined);

  const periodEnd = item?.current_period_end;

  /**
   * The Customer Portal schedules a cancellation by setting `cancel_at` to the
   * period end and leaves `cancel_at_period_end` false, so reading the boolean
   * alone never shows the operator that their plan is ending. Either signal
   * means the same thing here.
   */
  const cancelScheduled = Boolean(subscription.cancel_at_period_end) || subscription.cancel_at != null;

  const written = await prisma.organization.updateMany({
    where: {
      id: organizationId,
      OR: [{ subscriptionEventAt: null }, { subscriptionEventAt: { lte: observedAt } }],
    },
    data: {
      ...(plan ? { plan } : {}),
      subscriptionStatus: status,
      stripeSubscriptionId: subscription.id,
      cancelAtPeriodEnd: cancelScheduled,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      subscriptionEventAt: observedAt,
    },
  });

  return { organizationId, applied: written.count > 0 };
}
