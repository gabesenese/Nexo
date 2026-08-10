import { prisma } from "../db/client.js";
import { planFor, type PlanDefinition } from "../config/plans.js";

export interface UsageSummary {
  plan: PlanDefinition;
  periodStart: string;
  conversations: {
    used: number;
    limit: number;
    remaining: number;
    overage: number;
    percentUsed: number;
  };
  knowledgeSources: {
    used: number;
    limit: number | null;
    remaining: number | null;
    atLimit: boolean;
  };
}

/** Usage resets on the first of the calendar month, which is what a customer expects a monthly allowance to mean. */
export function currentPeriodStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function usageFor(organizationId: string): Promise<UsageSummary> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { plan: true },
  });
  const plan = planFor(org.plan);
  const periodStart = currentPeriodStart();

  const conversations = await prisma.conversation.count({
    where: { organizationId, createdAt: { gte: periodStart } },
  });
  const sources = await prisma.source.count({ where: { organizationId } });

  const limit = plan.conversationsPerMonth;

  return {
    plan,
    periodStart: periodStart.toISOString(),
    conversations: {
      used: conversations,
      limit,
      remaining: Math.max(limit - conversations, 0),
      overage: Math.max(conversations - limit, 0),
      percentUsed: limit ? conversations / limit : 0,
    },
    knowledgeSources: {
      used: sources,
      limit: plan.knowledgeSources,
      remaining: plan.knowledgeSources === null ? null : Math.max(plan.knowledgeSources - sources, 0),
      atLimit: plan.knowledgeSources !== null && sources >= plan.knowledgeSources,
    },
  };
}

/**
 * Knowledge sources are capped hard because the person hitting the cap is the
 * operator adding a source, who can see why and choose a plan.
 *
 * Conversations are deliberately not capped. The person on the other end of an
 * over-quota conversation is the customer's customer, who has no idea a plan
 * exists and did nothing wrong. Cutting off support to force an upgrade would
 * damage the very outcome we sell, so overage is surfaced to the workspace and
 * settled as a billing conversation instead.
 */
export async function canAddKnowledgeSource(organizationId: string) {
  const usage = await usageFor(organizationId);
  if (!usage.knowledgeSources.atLimit) return { allowed: true as const };

  return {
    allowed: false as const,
    limit: usage.knowledgeSources.limit!,
    planName: usage.plan.name,
  };
}
