import { env } from "../config/env.js";

export type TrialState = "none" | "active" | "expired";

export interface TrialStatus {
  state: TrialState;
  endsAt: string | null;
  daysRemaining: number | null;
}

export function trialEndDate(from = new Date()) {
  return new Date(from.getTime() + env.TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * A workspace with no `trialEndsAt` is not on a trial and is never blocked.
 * That covers everything created before trials existed, and anything moved to
 * a paid plan, so introducing trials cannot retroactively lock an existing
 * workspace out.
 */
export function trialStatusFor(trialEndsAt: Date | null): TrialStatus {
  if (!trialEndsAt) return { state: "none", endsAt: null, daysRemaining: null };

  const msLeft = trialEndsAt.getTime() - Date.now();
  const daysRemaining = Math.max(Math.ceil(msLeft / (24 * 60 * 60 * 1000)), 0);

  return {
    state: msLeft > 0 ? "active" : "expired",
    endsAt: trialEndsAt.toISOString(),
    daysRemaining,
  };
}

/**
 * Deliberately no `trialStatusForOrganization` here any more. Loading a
 * workspace and reading its trial state on its own is what locked paying
 * customers out on day 15: a subscriber's `trialEndsAt` stays in the past
 * forever. `entitlement.ts` is the only place that decides what a trial means,
 * because it is the only place that also looks at the subscription.
 */
