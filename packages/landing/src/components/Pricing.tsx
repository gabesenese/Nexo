import { StartCta } from "./StartCta";
import { PLAN_ROWS, formatCad } from "../pricing";

/**
 * Volumes and prices come from the same module as the comparison band, so the
 * two sections can never disagree about what Intercom costs.
 */
const FEATURES: Record<string, string[]> = {
  Essentials: ["2 knowledge sources", "Email support", "The whole product"],
  Professional: ["Unlimited knowledge sources", "Priority support", "The whole product"],
  Growth: ["Unlimited knowledge sources", "Priority onboarding", "The whole product"],
};

export function Pricing() {
  return (
    <section className="wrap pricing reveal" id="pricing">
      <div className="pricing-head" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="eyebrow">Simple pricing</p>
        <h2>Priced against what you are paying now.</h2>
        <p>No demos, no hidden pricing, no sales calls. All prices in Canadian dollars, plus applicable taxes.</p>
      </div>

      <div className="tiers" style={{ "--i": 1 } as React.CSSProperties}>
        {PLAN_ROWS.map((tier) => {
          const pick = tier.name === "Professional";
          return (
            <article className={`tier${pick ? " pick" : ""}`} key={tier.name}>
              <div className="tier-head">
                <h3>{tier.name}</h3>
                {pick && <span className="badge">MOST TEAMS</span>}
              </div>
              <p className="cap">Up to {tier.conversations.toLocaleString("en-CA")} conversations a month</p>
              <div className="price">
                {formatCad(tier.price)}
                <span>/mo</span>
              </div>
              <p className="vs">Intercom would be about {formatCad(tier.intercom)}</p>
              <div className="rule" />
              <ul>
                {FEATURES[tier.name].map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <StartCta
                className={`btn ${pick ? "btn-primary" : "btn-outline"}`}
                label="Start free trial"
                closedLabel="Request access"
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
