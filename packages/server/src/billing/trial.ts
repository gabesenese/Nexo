import { prisma } from "../db/client.js";
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

export async function trialStatusForOrganization(organizationId: string): Promise<TrialStatus> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { trialEndsAt: true },
  });
  return trialStatusFor(org?.trialEndsAt ?? null);
}

/**
 * An expired trial stops new conversations from starting. It deliberately does
 * not touch conversations already open: abandoning someone mid-question to
 * collect payment would punish the customer's customer for a billing decision
 * they had no part in, which is the same reason conversation quotas are not
 * enforced either. Operators keep full access to finish what is already in
 * flight, and to pay.
 */
export async function canStartNewConversation(organizationId: string) {
  const trial = await trialStatusForOrganization(organizationId);
  return trial.state !== "expired";
}
