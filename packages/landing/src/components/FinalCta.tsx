import { SIGNUP_OPEN, TRIAL_DAYS } from "../config";
import { StartCta } from "./StartCta";

export function FinalCta({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <section className="wrap">
      <div className="closer reveal solo">
        <h2>
          Answer. Escalate. <span style={{ color: "var(--accent)" }}>Resolve.</span>
        </h2>
        <p>
          Point Nexo at what you already have, put the widget on your site, and let your team keep the conversations
          that actually need them.
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
      </div>
    </section>
  );
}
