import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type PlanUsage } from "../api";

/**
 * Only once the allowance is actually passed. The Plan and usage card in
 * Settings already carries the approaching state, and a banner that appears
 * every month at 80% is furniture by the time it means something, the same
 * reasoning that keeps TrialBanner quiet until the last stretch.
 */
export function UsageBanner() {
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getPlan()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, []);

  if (!usage || usage.conversations.state !== "over") return null;

  const { overage, limit } = usage.conversations;

  return (
    <div className="usage-banner">
      <div className="ub-text">
        <strong>
          {overage.toLocaleString()} conversation{overage === 1 ? "" : "s"} over your monthly
          allowance of {limit.toLocaleString()}.
        </strong>{" "}
        Nexo is still answering and nobody contacting you is being turned away. Let's settle it as a
        billing conversation rather than cutting your customers off.
      </div>
      <button className="btn btn-primary btn-small" onClick={() => navigate("/settings")}>
        Review usage
      </button>
    </div>
  );
}
