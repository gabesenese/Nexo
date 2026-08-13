/**
 * Plan definitions carry limits and nothing else. Prices are deliberately
 * absent, but no longer because pricing is undecided: PHILOSOPHY.md section 5
 * sets it from competitive benchmarking (C$249 / C$899 / C$2,499) and retired
 * the customer-interview gate. Money stays out of this file so that enforcement
 * and the price list can move independently, and so a price change never risks
 * touching what a customer is allowed to do.
 */

export type PlanId = "essentials" | "professional" | "growth";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  conversationsPerMonth: number;
  /** Null means no limit. */
  knowledgeSources: number | null;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  essentials: {
    id: "essentials",
    name: "Essentials",
    conversationsPerMonth: 1500,
    knowledgeSources: 2,
  },
  professional: {
    id: "professional",
    name: "Professional",
    conversationsPerMonth: 8000,
    knowledgeSources: null,
  },
  growth: {
    id: "growth",
    name: "Growth",
    conversationsPerMonth: 50000,
    knowledgeSources: null,
  },
};

export const DEFAULT_PLAN: PlanId = "essentials";

export function planFor(id: string | null | undefined): PlanDefinition {
  return PLANS[(id ?? DEFAULT_PLAN) as PlanId] ?? PLANS[DEFAULT_PLAN];
}
