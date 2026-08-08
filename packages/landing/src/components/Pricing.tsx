interface Tier {
  name: string;
  price: string;
  desc: string;
  features: string[];
  highlighted?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Essentials",
    price: "$149",
    desc: "For teams just starting with AI support",
    features: ["Up to 1,500 conversations/mo", "2 knowledge sources", "1 helpdesk integration"],
  },
  {
    name: "Professional",
    price: "$499",
    desc: "Most mid-market teams start here",
    features: ["Up to 8,000 conversations/mo", "Unlimited knowledge sources", "All helpdesk integrations"],
    highlighted: true,
  },
  {
    name: "Growth",
    price: "$1,500",
    desc: "For higher-volume support teams",
    features: ["Up to 50,000 conversations/mo", "Custom flows + analytics API", "Priority onboarding"],
  },
];

import { ONBOARDING_URL } from "../config";

export function Pricing() {
  return (
    <section className="l-section" style={{ paddingTop: 0 }} id="pricing">
      <div className="pricing-wrap">
        <div className="pricing-head">
          <span className="l-eyebrow">Simple pricing</span>
          <h2>No demos. No hidden pricing. No enterprise sales calls.</h2>
        </div>
        <div className="pgrid">
          {TIERS.map((tier) => (
            <div className={`ptier${tier.highlighted ? " hi" : ""}`} key={tier.name}>
              <div className="pname">{tier.name}</div>
              <div className="pprice">
                {tier.price}
                <span>/mo</span>
              </div>
              <div className="pdesc">{tier.desc}</div>
              <ul>
                {tier.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <a className={`btn ${tier.highlighted ? "btn-primary" : "btn-ghost"}`} href={ONBOARDING_URL}>
                Start free
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
