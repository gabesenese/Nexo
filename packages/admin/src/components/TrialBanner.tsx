import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type TrialStatus } from "../api";

/**
 * Quiet for most of the trial. A banner that shouts from day one is furniture
 * by the time it matters, so it only appears in the last stretch or once the
 * trial has ended.
 */
const WARN_WITHIN_DAYS = 5;

export function TrialBanner() {
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getPlan()
      .then((p) => setTrial(p.trial))
      .catch(() => setTrial(null));
  }, []);

  if (!trial || trial.state === "none") return null;
  if (trial.state === "active" && (trial.daysRemaining ?? 99) > WARN_WITHIN_DAYS) return null;

  const expired = trial.state === "expired";
  const days = trial.daysRemaining ?? 0;

  return (
    <div className={`trial-banner ${expired ? "expired" : "ending"}`}>
      <div className="tb-text">
        {expired ? (
          <>
            <strong>Your trial has ended.</strong> Nexo has stopped answering new conversations.
            Anything already open is still yours to finish.
          </>
        ) : (
          <>
            <strong>
              {days === 0 ? "Your trial ends today." : `${days} day${days === 1 ? "" : "s"} left in your trial.`}
            </strong>{" "}
            Choose a plan to keep answering after it ends.
          </>
        )}
      </div>
      <button className="btn btn-primary btn-small" onClick={() => navigate("/settings")}>
        Choose a plan
      </button>
    </div>
  );
}
