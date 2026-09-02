import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../db/client.js";
import { trialStatusFor, type TrialStatus } from "./trial.js";

/**
 * Why a workspace is or is not entitled to answer new questions. The state is
 * returned rather than a bare boolean because the console has to explain the
 * situation to an operator, and "blocked" with no reason is what the trial
 * banner used to say.
 */
export type AccessState =
  /** Paying, or inside a Stripe-managed trial. */
  | "subscribed"
  /** Payment failed and Stripe is still retrying. Service continues. */
  | "grace"
  /** Inside the product's own signup trial, with no subscription yet. */
  | "trialing"
  /** The signup trial ran out and nothing was ever bought. */
  | "trial_expired"
  /** There was a subscription and it ended. */
  | "canceled"
  /** No trial and no subscription: pre-trial workspaces and self-hosted installs. */
  | "unlimited";

export interface WorkspaceAccess {
  state: AccessState;
  /**
   * Whether a visitor can open a *new* conversation. Conversations already in
   * flight are never interrupted, wherever this lands.
   */
  canStartNewConversation: boolean;
  trial: TrialStatus;
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
}

/**
 * Order matters here, and the ordering is the whole point.
 *
 * A subscription is checked before the trial clock, because the bug this
 * closes was a paying customer whose `trialEndsAt` had passed being told their
 * trial had expired. The trial only decides anything for a workspace that has
 * never subscribed.
 *
 * `past_due` keeps serving. Stripe's retry schedule runs for weeks, and the
 * person who suffers a failed card is the customer's customer, who has no idea
 * a billing relationship exists. The operator sees an urgent banner instead.
 * Entitlement stops at `canceled`, which is Stripe's word for the retries being
 * over.
 *
 * `canceled` blocks without consulting the trial, so a workspace created before
 * trials existed (`trialEndsAt` null, which never expires) cannot subscribe,
 * cancel, and keep the product for free.
 */
export function accessFor(input: {
  trialEndsAt: Date | null;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}): WorkspaceAccess {
  const trial = trialStatusFor(input.trialEndsAt);
  const subscription = {
    status: input.subscriptionStatus,
    currentPeriodEnd: input.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
  };

  const decide = (): { state: AccessState; canStartNewConversation: boolean } => {
    switch (input.subscriptionStatus) {
      case "active":
      case "trialing":
        return { state: "subscribed", canStartNewConversation: true };
      case "past_due":
        return { state: "grace", canStartNewConversation: true };
      case "canceled":
        return { state: "canceled", canStartNewConversation: false };
      case "none":
        break;
    }

    switch (trial.state) {
      case "active":
        return { state: "trialing", canStartNewConversation: true };
      case "expired":
        return { state: "trial_expired", canStartNewConversation: false };
      case "none":
        return { state: "unlimited", canStartNewConversation: true };
    }
  };

  return { ...decide(), trial, subscription };
}

export async function accessForOrganization(organizationId: string): Promise<WorkspaceAccess> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      trialEndsAt: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });
  return accessFor(org);
}
