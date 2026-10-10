import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type PlanUsage } from "../api";

/**
 * Only once the allowance is actually passed, and in two stages. Past the
 * allowance Nexo keeps answering and the banner says so. Past the fair-use
 * ceiling Nexo hands new conversations to the workspace's own team, and the
 * banner has to say that plainly, because it changes what customers experience.
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

  if (!usage || (usage.conversations.state !== "over" && !usage.fairUse.reached)) return null;

  const { overage, limit } = usage.conversations;
  const { ceiling, reached } = usage.fairUse;

  return (
    <div className="usage-banner">
      <div className="ub-text">
        {reached ? (
          <>
            <strong>
              You have passed your fair-use ceiling of {ceiling.toLocaleString()} conversations this
              month.
            </strong>{" "}
            Nexo is now handing new conversations to your team instead of answering them, so nobody is
            turned away but your team has to reply. Conversations already under way continue as normal.
            Upgrade your plan to have Nexo answer again, or wait for the month to reset.
          </>
        ) : (
          <>
            <strong>
              {overage.toLocaleString()} conversation{overage === 1 ? "" : "s"} over your monthly
              allowance of {limit.toLocaleString()}.
            </strong>{" "}
            Nexo is still answering. If this month passes {ceiling.toLocaleString()} conversations, new
            ones are handed to your team instead until you upgrade or the month resets.
          </>
        )}
      </div>
      <button className="btn btn-primary btn-small" onClick={() => navigate("/settings")}>
        Review usage
      </button>
    </div>
  );
}
