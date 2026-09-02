import Stripe from "stripe";
import { env } from "../config/env.js";
import type { PlanId } from "../config/plans.js";

/**
 * Billing is optional. A workspace runs perfectly without Stripe configured,
 * which keeps local development and self-hosted deployments from needing a
 * payment processor, so every caller has to handle billing being switched off.
 */
export function stripeEnabled() {
  return Boolean(env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set; billing is disabled.");
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}

const PRICE_BY_PLAN: Record<PlanId, string | undefined> = {
  essentials: env.STRIPE_PRICE_ESSENTIALS,
  professional: env.STRIPE_PRICE_PROFESSIONAL,
  growth: env.STRIPE_PRICE_GROWTH,
};

export function priceIdFor(plan: PlanId): string | undefined {
  return PRICE_BY_PLAN[plan];
}

/**
 * The reverse lookup is what makes a plan change made in the Stripe Dashboard
 * take effect here. Without it, an upgrade applied on Stripe's side would bill
 * the customer correctly and leave their limits untouched.
 */
export function planForPriceId(priceId: string): PlanId | null {
  const match = (Object.entries(PRICE_BY_PLAN) as [PlanId, string | undefined][]).find(
    ([, id]) => id !== undefined && id === priceId,
  );
  return match ? match[0] : null;
}

export interface PlanPrice {
  /** Minor units, as Stripe stores it. Formatting is the console's job. */
  amount: number;
  currency: string;
  interval: string | null;
}

/**
 * Prices are read from Stripe rather than restated in this codebase, so the
 * figure an operator is shown is the figure their card is charged. A second
 * copy in `plans.ts` would be a number that can silently disagree with the one
 * that takes the money, and the console is where that disagreement would be
 * discovered last.
 */
const priceCache = new Map<string, { value: PlanPrice; expires: number }>();
const PRICE_TTL_MS = 5 * 60 * 1000;

export async function priceDetailsFor(plan: PlanId): Promise<PlanPrice | null> {
  const priceId = priceIdFor(plan);
  if (!priceId || !stripeEnabled()) return null;

  const cached = priceCache.get(priceId);
  if (cached && cached.expires > Date.now()) return cached.value;

  try {
    const price = await stripeClient().prices.retrieve(priceId);
    if (price.unit_amount === null) return null;
    const value: PlanPrice = {
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
    };
    priceCache.set(priceId, { value, expires: Date.now() + PRICE_TTL_MS });
    return value;
  } catch {
    /**
     * A price that cannot be read is shown as unpriced rather than as a guess.
     * The plan stays visible and unbuyable, which is the truthful rendering of
     * a misconfigured price id.
     */
    return null;
  }
}
