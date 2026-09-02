import { useCallback, useEffect, useState } from "react";
import { api, type BillingSummary } from "../api";

/**
 * `Intl` renders CAD as a bare "$", which reads as USD to most of the internet.
 * The landing page had the same ambiguity and fixed it the same way.
 */
function formatPrice(price: { amount: number; currency: string; interval: string | null }) {
  const amount = (price.amount / 100).toLocaleString("en-CA", {
    minimumFractionDigits: price.amount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const symbol = price.currency.toLowerCase() === "cad" ? "C$" : `${price.currency.toUpperCase()} `;
  return price.interval ? `${symbol}${amount}/${price.interval}` : `${symbol}${amount}`;
}

function periodLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" });
}

export function BillingCard() {
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getBilling()
      .then(setBilling)
      .catch(() => setBilling(null));
  }, []);

  useEffect(load, [load]);

  /**
   * Checkout returns from Stripe with `?billing=done`, but the subscription is
   * activated by a webhook that may not have landed yet. Re-reading once on
   * return is what turns the card from "no plan" into the plan they just bought
   * without making them reload.
   */
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get("billing");
    if (outcome !== "done") return;
    const timer = setTimeout(load, 1500);
    return () => clearTimeout(timer);
  }, [load]);

  if (!billing) return null;

  if (!billing.enabled) {
    return (
      <div className="card">
        <h3>Billing</h3>
        <div className="card-sub">
          Billing is not configured on this deployment, so there is nothing to pay here.
        </div>
      </div>
    );
  }

  const { access, plans } = billing;
  const subscribed = access.state === "subscribed" || access.state === "grace";

  const go = async (action: () => Promise<{ url: string | null }>, key: string) => {
    setBusy(key);
    setError(null);
    try {
      const { url } = await action();
      if (url) {
        window.location.href = url;
        return;
      }
      setError("Stripe did not return a checkout link. Try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card">
      <h3>Billing</h3>
      <div className="card-sub">{statusLine(access)}</div>

      {error && <p className="usage-note over">{error}</p>}

      {subscribed ? (
        <div className="billing-actions">
          <button
            className="btn"
            disabled={busy !== null}
            onClick={() => go(api.openBillingPortal, "portal")}
          >
            {busy === "portal" ? "Opening…" : "Manage payment and invoices"}
          </button>
          <p className="card-sub">
            Card details, invoices, plan changes and cancellation are handled by Stripe.
          </p>
        </div>
      ) : (
        <div className="billing-plans">
          {plans.map((plan) => (
            <div key={plan.id} className="billing-plan">
              <div className="billing-plan-head">
                <strong>{plan.name}</strong>
                {plan.price ? (
                  <span className="billing-price">{formatPrice(plan.price)}</span>
                ) : (
                  <span className="card-sub">Not available on this deployment</span>
                )}
              </div>
              <div className="card-sub">
                {plan.conversationsPerMonth.toLocaleString()} conversations a month ·{" "}
                {plan.knowledgeSources === null
                  ? "unlimited knowledge sources"
                  : `${plan.knowledgeSources} knowledge sources`}
              </div>
              <button
                className={`btn ${plan.id === "professional" ? "btn-primary" : ""}`}
                disabled={!plan.purchasable || busy !== null}
                onClick={() => go(() => api.startCheckout(plan.id), plan.id)}
              >
                {busy === plan.id ? "Opening Stripe…" : `Choose ${plan.name}`}
              </button>
            </div>
          ))}
          {billing.hasCustomer && (
            <button
              className="btn btn-quiet"
              disabled={busy !== null}
              onClick={() => go(api.openBillingPortal, "portal")}
            >
              {busy === "portal" ? "Opening…" : "View past invoices"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Every branch says what is true now and what happens next, never just a status word. */
function statusLine(access: BillingSummary["access"]): string {
  const ends = access.subscription.currentPeriodEnd;

  switch (access.state) {
    case "subscribed":
      if (access.subscription.cancelAtPeriodEnd && ends) {
        return `Your plan is paid until ${periodLabel(ends)} and will not renew.`;
      }
      return ends ? `Your plan renews on ${periodLabel(ends)}.` : "Your plan is active.";
    case "grace":
      return "Your last payment did not go through. Nexo is still answering while Stripe retries. Update your card to avoid an interruption.";
    case "trialing":
      return access.trial.daysRemaining !== null
        ? `${access.trial.daysRemaining} day${access.trial.daysRemaining === 1 ? "" : "s"} left in your trial. Choose a plan to keep answering after it ends.`
        : "You are on a trial. Choose a plan to keep answering after it ends.";
    case "trial_expired":
      return "Your trial has ended and Nexo has stopped answering new conversations. Choose a plan to start again.";
    case "canceled":
      return "Your subscription has ended and Nexo has stopped answering new conversations. Choose a plan to start again.";
    case "unlimited":
      return "This workspace has no trial or subscription attached.";
  }
}
