import { prisma } from "../db/client.js";
import { planFor, type PlanDefinition } from "../config/plans.js";
import { env } from "../config/env.js";

/**
 * `approaching` exists so the first thing an operator hears about their
 * allowance is not that they have already passed it. It is a warning, not a
 * gate: nothing behaves differently at any of these states. The fair-use
 * ceiling further down is the separate gate.
 */
export type ConversationUsageState = "ok" | "approaching" | "over";

const APPROACHING_AT = 0.8;

export interface UsageSummary {
  plan: PlanDefinition;
  periodStart: string;
  conversations: {
    used: number;
    limit: number;
    remaining: number;
    overage: number;
    percentUsed: number;
    state: ConversationUsageState;
  };
  knowledgeSources: {
    used: number;
    limit: number | null;
    remaining: number | null;
    atLimit: boolean;
  };
  /**
   * The point past which new conversations go to the workspace's own team
   * instead of the AI. See `overFairUseCeiling`.
   */
  fairUse: {
    ceiling: number;
    reached: boolean;
  };
}

/** The most conversations a plan's AI will answer in a month before new ones are handed to a person. */
export function fairUseCeiling(plan: PlanDefinition, multiplier: number): number {
  return Math.floor(plan.conversationsPerMonth * Math.max(multiplier, 1));
}

export function conversationUsageState(percentUsed: number): ConversationUsageState {
  if (percentUsed > 1) return "over";
  if (percentUsed >= APPROACHING_AT) return "approaching";
  return "ok";
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
  const percentUsed = limit ? conversations / limit : 0;
  const ceiling = fairUseCeiling(plan, env.FAIR_USE_MULTIPLIER);

  return {
    plan,
    periodStart: periodStart.toISOString(),
    conversations: {
      used: conversations,
      limit,
      remaining: Math.max(limit - conversations, 0),
      overage: Math.max(conversations - limit, 0),
      percentUsed,
      state: conversationUsageState(percentUsed),
    },
    knowledgeSources: {
      used: sources,
      limit: plan.knowledgeSources,
      remaining: plan.knowledgeSources === null ? null : Math.max(plan.knowledgeSources - sources, 0),
      atLimit: plan.knowledgeSources !== null && sources >= plan.knowledgeSources,
    },
    fairUse: { ceiling, reached: conversations >= ceiling },
  };
}

/**
 * Knowledge sources are capped hard because the person hitting the cap is the
 * operator adding a source, who can see why and choose a plan.
 *
 * Conversations are not refused, because the person on the other end of an
 * over-quota conversation is the customer's customer, who has no idea a plan
 * exists and did nothing wrong. But they are not unbounded either, since every
 * AI answer costs real money and a flat price cannot absorb unlimited volume.
 * Two stages, then. Past the allowance the workspace is told and Nexo keeps
 * answering. Past the fair-use ceiling (allowance times FAIR_USE_MULTIPLIER) new
 * conversations are handed straight to the workspace's own team, so the
 * customer still reaches a person and the AI spend stops growing. Conversations
 * already under way are never interrupted.
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

/**
 * Whether a new conversation should skip the AI and go to a person. One count
 * query per new conversation, never per message. Concurrent first messages can
 * pass a few over the ceiling, which is fine for a cost guard.
 *
 * Called after the conversation has been created, so the count already includes
 * it: the conversation that is number `ceiling` of the month is the last one the
 * AI answers, and number `ceiling + 1` is the first handed over. That matches
 * `fairUse.reached` in the usage summary, which turns true when the next new
 * conversation will be handed over.
 */
export async function overFairUseCeiling(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { plan: true } });
  const ceiling = fairUseCeiling(planFor(org?.plan), env.FAIR_USE_MULTIPLIER);
  const used = await prisma.conversation.count({
    where: { organizationId, createdAt: { gte: currentPeriodStart() } },
  });
  return used > ceiling;
}
