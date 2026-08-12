import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type AuthUser, type OverviewSummary, type SourceSummary } from "../api";
import { NeedsAttention } from "../components/NeedsAttention";
import { subscribeToUpdates } from "../realtime";

/** The realtime stream drives updates; this only covers a stream that never connected. */
const FALLBACK_REFRESH_MS = 60000;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(user: AuthUser | null): string {
  return user?.name.trim().split(/\s+/)[0] ?? "";
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function percent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewSummary | null>(null);
  const [sources, setSources] = useState<SourceSummary[] | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function refresh() {
    try {
      const [next, srcs] = await Promise.all([api.getOverview(), api.listSources()]);
      setOverview(next);
      setSources(srcs);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    api.me().then(setUser).catch(() => {});
    const id = setInterval(refresh, FALLBACK_REFRESH_MS);
    /** The command centre reacts to the same events the inbox does. */
    const unsubscribe = subscribeToUpdates(["conversations", "attention", "notifications"], refresh);
    return () => {
      clearInterval(id);
      unsubscribe();
    };
  }, []);

  const header = (
    <div className="page-top">
      <div>
        <h1>Overview</h1>
        <p className="sub">
          {firstName(user) ? `${greeting()}, ${firstName(user)}. ` : ""}
          Here's what needs attention and how Nexo is performing.
        </p>
      </div>
    </div>
  );

  if (error && !overview) {
    return (
      <div>
        {header}
        <div className="card">
          <p className="error-text">Could not load your overview. {error}</p>
          <button className="btn btn-ghost" onClick={refresh}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!overview || !sources) {
    return (
      <div>
        {header}
        <div className="card">
          <p className="empty-note">Loading…</p>
        </div>
      </div>
    );
  }

  const hasConversations = overview.counts.total > 0;
  const hasSources = sources.length > 0;

  /** Nothing has happened yet, so the page is a setup checklist rather than a wall of zeroes. */
  if (!hasConversations) {
    return (
      <div>
        {header}
        <div className="empty-hero">
          <div className="eh-mark">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" stroke="#2f6f5e" strokeWidth="1.4" />
              <path
                d="M6 13V7l8 6V7"
                stroke="#181b1d"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2>Nothing to show yet — let's fix that</h2>
          <p>Connect a knowledge source and install the widget to start resolving conversations.</p>
          <div className="setup-steps">
            <div className={`setup-step ${hasSources ? "done" : ""}`}>
              <span className="ss-num">{hasSources ? "✓" : "1"}</span>
              Connect a knowledge source
            </div>
            <div className="setup-step">
              <span className="ss-num">2</span>
              Install the widget on your site
            </div>
          </div>
          <div className="empty-hero-actions">
            <Link className="btn btn-primary" to="/sources">
              Add a knowledge source
            </Link>
            <Link className="btn btn-ghost" to="/settings">
              Get the install snippet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}

      {/** What is on the floor right now, rather than lifetime totals. */}
      <div className="status-strip">
        <div className="status-cell">
          <div className="kl">Open</div>
          <div className="kv">{overview.counts.open}</div>
        </div>
        <div className="status-cell">
          <div className="kl">Waiting on a human</div>
          <div className={`kv${overview.counts.waitingOnHuman > 0 ? " urgent" : ""}`}>
            {overview.counts.waitingOnHuman}
          </div>
        </div>
        <div className="status-cell">
          <div className="kl">Resolved today</div>
          <div className="kv">{overview.counts.resolvedToday}</div>
        </div>
        <div className="status-cell">
          <div className="kl">Resolution rate</div>
          <div className="kv">{percent(overview.rates.resolution)}</div>
        </div>
        <div className="status-cell">
          <div className="kl">Escalation rate</div>
          <div className="kv">{percent(overview.rates.escalation)}</div>
        </div>
      </div>

      <NeedsAttention />

      <div className="row">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Knowledge health</h3>
              <div className="card-sub">
                {overview.knowledgeHealth.total === 0
                  ? "Nothing has stumped Nexo yet"
                  : `${overview.knowledgeHealth.total} question${
                      overview.knowledgeHealth.total === 1 ? "" : "s"
                    } Nexo could not confidently answer` +
                    (overview.knowledgeHealth.uncovered > 0
                      ? `, ${overview.knowledgeHealth.uncovered} with no source at all`
                      : "")}
              </div>
            </div>
            {overview.knowledgeHealth.total > 0 && (
              <Link className="btn-small" to="/knowledge-gaps">
                View all
              </Link>
            )}
          </div>

          {overview.knowledgeHealth.total === 0 ? (
            <p className="empty-note">
              When Nexo hands a conversation over because it wasn't confident, the question shows up
              here with whether anything in your sources covers it.
            </p>
          ) : (
            overview.knowledgeHealth.top.map((gap) => (
              <div
                className="list-item"
                key={gap.id}
                data-clickable
                onClick={() => navigate("/knowledge-gaps")}
              >
                <div className="gap-count">{gap.occurrences}</div>
                <div className="list-info">
                  <div className="li-title">{gap.question}</div>
                  <div className="attention-meta">
                    {gap.occurrences === 1 ? "asked once" : `asked ${gap.occurrences} times`} ·{" "}
                    {gap.coverage.covered ? (
                      <>covered by {gap.coverage.source}, but the answer wasn't confident</>
                    ) : (
                      <span className="gap-waiting">no source covers this</span>
                    )}
                  </div>
                </div>
                <span className="attention-action">View gap →</span>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3>Recent activity</h3>
          <div className="card-sub">What Nexo and your team have done</div>
          {overview.activity.length === 0 ? (
            <p className="empty-note">Nothing has happened yet.</p>
          ) : (
            overview.activity.map((entry) => (
              <div
                className="list-item"
                key={entry.id}
                data-clickable={entry.conversationId ? true : undefined}
                onClick={
                  entry.conversationId
                    ? () => navigate(`/conversations?id=${entry.conversationId}`)
                    : undefined
                }
              >
                <span className={`activity-dot ${entry.type}`} aria-hidden="true" />
                <div className="list-info">
                  <div className="li-title activity-summary">{entry.summary}</div>
                  <div className="attention-meta">{timeAgo(entry.at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
