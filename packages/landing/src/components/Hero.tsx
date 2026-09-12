import { ONBOARDING_URL, TRIAL_DAYS } from "../config";

export function Hero({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <section className="wrap hero" id="top">
      <div className="pill">
        <b>NEW</b> Every handoff now carries the reason Nexo stopped
      </div>
      <h1>
        Every answer
        <br />
        has an <span className="grad">exit</span>.
      </h1>
      <p className="hero-sub">
        AI support for SaaS teams of two to twenty. It answers only what it can ground and cite, and hands everything
        else to a person with the whole thread attached.
      </p>
      <div className="hero-cta">
        <a className="btn btn-primary" href={ONBOARDING_URL}>
          Start free trial
        </a>
        <button className="btn btn-ghost" type="button" onClick={onOpenTrial}>
          Talk to us
        </button>
      </div>
      <p className="terms">{TRIAL_DAYS} DAYS &middot; NO CARD &middot; DATA STAYS IN CANADA</p>
    </section>
  );
}
