import { SIGNUP_OPEN, TRIAL_DAYS } from "../config";
import { StartCta } from "./StartCta";

/**
 * The nav collapses on a phone, which previously left the whole page below
 * the hero with no visible way to start. This rides in once the hero leaves.
 */
export function MobileCta() {
  return (
    <div className="mobile-cta" id="mobile-cta">
      <div className="mc-copy">
        <strong>{SIGNUP_OPEN ? `${TRIAL_DAYS} days free` : "Early access"}</strong>
        <span>{SIGNUP_OPEN ? "No credit card. Cancel anytime." : "We will email you the moment it opens."}</span>
      </div>
      <StartCta className="btn btn-primary btn-sm" label="Start free trial" closedLabel="Request access" />
    </div>
  );
}
