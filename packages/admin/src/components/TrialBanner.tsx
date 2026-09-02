import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type WorkspaceAccess } from "../api";

/**
 * Quiet for most of the trial. A banner that shouts from day one is furniture
 * by the time it matters, so it only appears in the last stretch or once the
 * workspace has actually stopped answering.
 */
const WARN_WITHIN_DAYS = 5;

export function TrialBanner() {
  const [access, setAccess] = useState<WorkspaceAccess | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getPlan()
      .then((p) => setAccess(p.access))
      .catch(() => setAccess(null));
  }, []);

  if (!access) return null;

  const notice = noticeFor(access);
  if (!notice) return null;

  return (
    <div className={`trial-banner ${notice.tone}`}>
      <div className="tb-text">{notice.text}</div>
      <button className="btn btn-primary btn-small" onClick={() => navigate("/settings?tab=billing")}>
        {notice.cta}
      </button>
    </div>
  );
}

interface Notice {
  tone: "expired" | "ending";
  text: React.ReactNode;
  cta: string;
}

/**
 * Reads the combined access state rather than the trial clock. A subscribed
 * workspace's `trialEndsAt` is still in the past forever, so the old version of
 * this banner told paying customers their trial had ended.
 */
function noticeFor(access: WorkspaceAccess): Notice | null {
  switch (access.state) {
    case "trial_expired":
      return {
        tone: "expired",
        cta: "Choose a plan",
        text: (
          <>
            <strong>Your trial has ended.</strong> Nexo has stopped answering new conversations.
            Anything already open is still yours to finish.
          </>
        ),
      };
    case "canceled":
      return {
        tone: "expired",
        cta: "Choose a plan",
        text: (
          <>
            <strong>Your subscription has ended.</strong> Nexo has stopped answering new
            conversations. Anything already open is still yours to finish.
          </>
        ),
      };
    case "grace":
      return {
        tone: "expired",
        cta: "Update payment",
        text: (
          <>
            <strong>Your last payment did not go through.</strong> Nexo is still answering while
            Stripe retries, so your customers are unaffected for now.
          </>
        ),
      };
    case "trialing": {
      const days = access.trial.daysRemaining;
      if (days === null || days > WARN_WITHIN_DAYS) return null;
      return {
        tone: "ending",
        cta: "Choose a plan",
        text: (
          <>
            <strong>
              {days === 0 ? "Your trial ends today." : `${days} day${days === 1 ? "" : "s"} left in your trial.`}
            </strong>{" "}
            Choose a plan to keep answering after it ends.
          </>
        ),
      };
    }
    case "subscribed":
    case "unlimited":
      return null;
  }
}
