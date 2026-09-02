import { describe, expect, it } from "vitest";
import { accessFor } from "../src/billing/entitlement.js";
import { mapStatus } from "../src/billing/subscription.js";

const DAY = 24 * 60 * 60 * 1000;
const past = new Date(Date.now() - 30 * DAY);
const future = new Date(Date.now() + 3 * DAY);

function access(overrides: Partial<Parameters<typeof accessFor>[0]> = {}) {
  return accessFor({
    trialEndsAt: null,
    subscriptionStatus: "none",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    ...overrides,
  });
}

describe("accessFor", () => {
  /**
   * The bug this whole module exists to close. A paying customer's trial end
   * date stays in the past forever, so anything that reads the trial clock on
   * its own locks them out on day 15 while their card is being charged.
   */
  it("keeps a paying workspace answering long after its trial date has passed", () => {
    const result = access({ trialEndsAt: past, subscriptionStatus: "active" });
    expect(result.state).toBe("subscribed");
    expect(result.canStartNewConversation).toBe(true);
  });

  it("serves an active trial with no subscription", () => {
    const result = access({ trialEndsAt: future });
    expect(result.state).toBe("trialing");
    expect(result.canStartNewConversation).toBe(true);
  });

  it("stops new conversations once an unpaid trial runs out", () => {
    const result = access({ trialEndsAt: past });
    expect(result.state).toBe("trial_expired");
    expect(result.canStartNewConversation).toBe(false);
  });

  /**
   * Stripe retries a failed payment for weeks. The person who would be cut off
   * is the customer's customer, who has no idea a billing relationship exists,
   * so service continues and the operator gets a banner instead.
   */
  it("keeps serving while a payment is being retried", () => {
    const result = access({ trialEndsAt: past, subscriptionStatus: "past_due" });
    expect(result.state).toBe("grace");
    expect(result.canStartNewConversation).toBe(true);
  });

  it("stops once the subscription is actually canceled", () => {
    const result = access({ trialEndsAt: past, subscriptionStatus: "canceled" });
    expect(result.state).toBe("canceled");
    expect(result.canStartNewConversation).toBe(false);
  });

  /**
   * A workspace created before trials existed has a null `trialEndsAt`, which
   * never expires. Falling through to the trial rule after a cancellation would
   * let exactly those workspaces subscribe, cancel, and keep the product free.
   */
  it("does not let a null trial date rescue a canceled subscription", () => {
    const result = access({ trialEndsAt: null, subscriptionStatus: "canceled" });
    expect(result.state).toBe("canceled");
    expect(result.canStartNewConversation).toBe(false);
  });

  it("leaves a workspace with no trial and no subscription alone", () => {
    const result = access();
    expect(result.state).toBe("unlimited");
    expect(result.canStartNewConversation).toBe(true);
  });

  it("reports a scheduled cancellation without withdrawing access", () => {
    const result = access({
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: future,
    });
    expect(result.state).toBe("subscribed");
    expect(result.canStartNewConversation).toBe(true);
    expect(result.subscription.cancelAtPeriodEnd).toBe(true);
    expect(result.subscription.currentPeriodEnd).toBe(future.toISOString());
  });
});

describe("mapStatus", () => {
  it("treats only genuinely paid states as entitling", () => {
    expect(mapStatus("active")).toBe("active");
    expect(mapStatus("trialing")).toBe("trialing");
  });

  /**
   * `unpaid` and `incomplete` both mean no money has arrived. Mapping either to
   * active would hand out the product on a checkout that was abandoned at the
   * card step.
   */
  it("does not treat an unpaid subscription as active", () => {
    expect(mapStatus("unpaid")).toBe("past_due");
    expect(mapStatus("incomplete")).toBe("past_due");
    expect(mapStatus("past_due")).toBe("past_due");
  });

  it("ends entitlement on every terminal state", () => {
    expect(mapStatus("canceled")).toBe("canceled");
    expect(mapStatus("incomplete_expired")).toBe("canceled");
    expect(mapStatus("paused")).toBe("canceled");
  });

  /**
   * Stripe can add statuses. An unknown one must not be read as paid, because
   * the failure would be silent and in the customer's favour at our expense.
   */
  it("refuses to guess that an unknown status means paid", () => {
    expect(mapStatus("something_new" as never)).toBe("none");
  });
});
