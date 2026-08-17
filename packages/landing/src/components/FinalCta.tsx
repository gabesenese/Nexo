import { ONBOARDING_URL } from "../config";

export function FinalCta({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <section className="final">
      <div className="final-glow" aria-hidden="true" />
      <div className="wrap">
        <h2>
          Answer. Escalate. <span className="em">Resolve.</span>
        </h2>
        <p>
          Point Nexo at what you already have, put the widget on your site, and let your team keep
          the conversations that actually need them.
        </p>
        <div className="final-ctas">
          <a className="btn btn-primary btn-lg" href={ONBOARDING_URL}>
            Start free trial
          </a>
          <button className="btn btn-ghost btn-lg" onClick={onOpenTrial}>
            Talk to us
          </button>
        </div>
        <p className="hero-note">$0 minimum · no sales call · cancel anytime</p>
      </div>
    </section>
  );
}
