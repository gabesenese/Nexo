import { ONBOARDING_URL, SIGNUP_OPEN } from "../config";
import { useTrial } from "../TrialContext";

/**
 * One control with two honest meanings. Until the app is deployed there is
 * nothing at the other end of /onboarding, so every start button asks for early
 * access instead of sending someone to a page that cannot answer.
 */
export function StartCta({
  className,
  label,
  closedLabel = "Request early access",
}: {
  className: string;
  label: string;
  closedLabel?: string;
}) {
  const openTrial = useTrial();

  if (SIGNUP_OPEN) {
    return (
      <a className={className} href={ONBOARDING_URL}>
        {label}
      </a>
    );
  }

  return (
    <button className={className} type="button" onClick={openTrial}>
      {closedLabel}
    </button>
  );
}
