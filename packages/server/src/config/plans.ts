/**
 * Plan definitions carry limits and nothing else. Prices are deliberately
 * absent: PHILOSOPHY.md holds pricing open until real customer interviews,
 * and the figures on the landing page are a hypothesis rather than a
 * decision. Keeping money out of this file means the interviews can change
 * every number without touching enforcement.
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
