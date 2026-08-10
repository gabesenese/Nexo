import { useEffect, useState } from "react";
import { api, type PlanUsage } from "../api";

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function PlanUsageCard() {
  const [usage, setUsage] = useState<PlanUsage | null>(null);

  useEffect(() => {
    api.getPlan().then(setUsage).catch(() => setUsage(null));
  }, []);

  if (!usage) return null;

  const { conversations, knowledgeSources, plan } = usage;
  const overQuota = conversations.overage > 0;
  const nearQuota = !overQuota && conversations.percentUsed >= 0.8;
  const barWidth = Math.min(conversations.percentUsed, 1) * 100;
  const barState = overQuota ? "over" : nearQuota ? "near" : "";

  return (
    <div className="card">
      <h3>Plan and usage</h3>
      <div className="card-sub">
        {plan.name} · usage resets at the start of each month · showing {monthLabel(usage.periodStart)}
      </div>

      <div className="usage-row">
        <div className="usage-head">
          <span>Conversations</span>
          <span className="usage-figures">
            {conversations.used.toLocaleString()} of {conversations.limit.toLocaleString()}
          </span>
        </div>
        <div className="usage-bar">
          <div className={`usage-fill ${barState}`} style={{ width: `${barWidth}%` }} />
        </div>
        {overQuota ? (
          <p className="usage-note over">
            {conversations.overage.toLocaleString()} over your monthly allowance. Nexo keeps
            answering, and nobody contacting you is turned away. We will settle the difference rather
            than cut off your customers.
          </p>
        ) : nearQuota ? (
          <p className="usage-note near">
            {conversations.remaining.toLocaleString()} left this month.
          </p>
        ) : null}
      </div>

      <div className="usage-row">
        <div className="usage-head">
          <span>Knowledge sources</span>
          <span className="usage-figures">
            {knowledgeSources.limit === null
              ? `${knowledgeSources.used} · unlimited`
              : `${knowledgeSources.used} of ${knowledgeSources.limit}`}
          </span>
        </div>
        {knowledgeSources.atLimit && (
          <p className="usage-note over">
            You have used every source on {plan.name}. Remove one to add another, or move to a plan
            with more.
          </p>
        )}
      </div>
    </div>
  );
}
