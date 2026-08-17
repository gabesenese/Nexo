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
    price: "C$249",
    desc: "For teams just starting with AI support",
    features: ["Up to 1,500 conversations/mo", "2 knowledge sources", "Email support"],
  },
  {
    name: "Professional",
    price: "C$899",
    desc: "Most mid-market teams start here",
    features: ["Up to 8,000 conversations/mo", "Unlimited knowledge sources", "Priority support"],
    highlighted: true,
  },
  {
    name: "Growth",
    price: "C$2,499",
    desc: "For higher-volume support teams",
    features: ["Up to 50,000 conversations/mo", "Unlimited knowledge sources", "Priority onboarding"],
  },
];

import { ONBOARDING_URL } from "../config";

export function Pricing() {
  return (
    <section className="l-section" style={{ paddingTop: 0 }} id="pricing">
      <div className="pricing-wrap">
        <div className="pricing-head">
          <span className="l-eyebrow">Simple pricing</span>
          <h2>No demos. No hidden pricing. No sales calls.</h2>
          <p className="pricing-currency">All prices in Canadian dollars, plus applicable taxes.</p>
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
                  <li key={f}>
                    <span className="chk" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 12l4 4L19 7" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a className={`btn ${tier.highlighted ? "btn-primary" : "btn-ghost"}`} href={ONBOARDING_URL}>
                Start free
              </a>
            </div>
          ))}
        </div>
        <p className="pricing-included">
          Every plan includes the whole product: AI answers with cited sources, one-click handoff to
          a human with the full conversation, the escalation queue, conversation ownership, reports
          on the questions Nexo could not answer, and a signed webhook that posts every handoff to
          your helpdesk.
        </p>
      </div>
    </section>
  );
}
