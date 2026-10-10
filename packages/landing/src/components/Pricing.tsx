import { StartCta } from "./StartCta";
import { PLAN_ROWS, formatCad } from "../pricing";

/**
 * Volumes and prices come from the same module as the comparison band, so the
 * two sections can never disagree about what Intercom costs.
 */
const FEATURES: Record<string, string[]> = {
  Essentials: ["Answers from 2 sources", "Email support", "Every feature included"],
  Professional: ["Answers from unlimited sources", "Priority support", "Every feature included"],
  Growth: ["Answers from unlimited sources", "Priority onboarding", "Every feature included"],
};

export function Pricing() {
  return (
    <section className="wrap pricing reveal" id="pricing">
      <div className="pricing-head" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="eyebrow">Plans</p>
        <h2>Pick a plan by how many chats you get.</h2>
        <p>Public prices and no sales calls. All prices in Canadian dollars, plus applicable taxes.</p>
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
              <p className="cap">Up to {tier.conversations.toLocaleString("en-CA")} chats a month</p>
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
                arrow={pick}
              />
            </article>
          );
        })}
      </div>

      <p className="pricing-note" style={{ "--i": 2 } as React.CSSProperties}>
        Past twice a plan&rsquo;s monthly chats, new chats go to your own team instead of Nexo. Nobody is turned away,
        and chats already under way carry on.
      </p>
    </section>
  );
}
