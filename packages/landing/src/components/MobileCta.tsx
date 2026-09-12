import { ONBOARDING_URL, TRIAL_DAYS } from "../config";

/**
 * The nav collapses on a phone, which previously left the whole page below
 * the hero with no visible way to start. This rides in once the hero leaves.
 */
export function MobileCta() {
  return (
    <div className="mobile-cta" id="mobile-cta">
      <div className="mc-copy">
        <strong>{TRIAL_DAYS} days free</strong>
        <span>No credit card. Cancel anytime.</span>
      </div>
      <a className="btn btn-primary btn-sm" href={ONBOARDING_URL}>
        Start free trial
      </a>
    </div>
  );
}
