import { SIGNUP_OPEN, TRIAL_DAYS } from "../config";
import { StartCta } from "./StartCta";

export function Hero({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <section className="wrap hero" id="top">
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
        <StartCta className="btn btn-primary" label="Start free trial" />
        <button className="btn btn-ghost" type="button" onClick={onOpenTrial}>
          Talk to us
        </button>
      </div>
      <p className="terms">
        {SIGNUP_OPEN ? `${TRIAL_DAYS} DAYS` : "EARLY ACCESS"} &middot; NO CARD &middot; NO SALES CALL
      </p>
    </section>
  );
}
