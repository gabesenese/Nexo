import { useEffect, useState } from "react";
import { api, type AnalyticsSummary, type Conversation, type SourceSummary } from "../api";
import { NeedsAttention } from "../components/NeedsAttention";

function initials(sessionId: string) {
  return sessionId.slice(0, 2).toUpperCase();
}

/** What the customer opened with, which is what identifies a thread to an operator. */
function subjectOf(c: Conversation) {
  return c.messages.find((m) => m.role === "user")?.content.trim() || "No message yet";
}

function latestReply(c: Conversation) {
  const last = c.messages[c.messages.length - 1];
  if (!last) return "";
  const who = last.role === "user" ? "Customer" : last.role === "agent" ? "You" : "Nexo";
  return `${who}: ${last.content.trim()}`;
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [sources, setSources] = useState<SourceSummary[] | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  useEffect(() => {
    api.getAnalytics().then(setData);
    api.listSources().then(setSources);
    api.listConversations().then(setConversations);
  }, []);

  if (!data || !sources || !conversations) {
    return (
      <div>
        <div className="page-top">
          <div>
            <h1>Overview</h1>
          </div>
        </div>
        <p className="empty-note">Loading…</p>
      </div>
    );
  }

  const hasConversations = data.totalConversations > 0;
  const hasSources = sources.length > 0;

  return (
    <div>
      <div className="page-top">
        <div>
          <h1>Overview</h1>
          <p className="sub">What needs a person right now, and how Nexo is doing on the rest.</p>
        </div>
      </div>

      {!hasConversations && (
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
          <p>
            Connect a knowledge source and try the widget to start resolving conversations.
          </p>
          <div className="setup-steps">
            <div className={`setup-step ${hasSources ? "done" : ""}`}>
              <span className="ss-num">{hasSources ? "✓" : "1"}</span>
              Connect a knowledge source
            </div>
            <div className="setup-step">
              <span className="ss-num">2</span>
              Try the widget demo
            </div>
          </div>
        </div>
      )}

      {/**
       * The queue leads the page. These figures are how the operation is
       * trending, which matters, but never before the list of people currently
       * waiting on a reply.
       */}
      {hasConversations && <NeedsAttention />}

      <div className="kpis">
        <div className="kpi">
          <div className="kl">Total conversations</div>
          <div className="kv">{data.totalConversations}</div>
        </div>
        <div className="kpi">
          <div className="kl">Resolution rate</div>
          <div className="kv">{hasConversations ? `${(data.resolutionRate * 100).toFixed(0)}%` : "—"}</div>
          {data.reopenedConversations > 0 && (
            <div className="kpi-note">
              {data.reopenedConversations} came back after being resolved
            </div>
          )}
        </div>
        <div className="kpi">
          <div className="kl">Escalation rate</div>
          <div className="kv">{hasConversations ? `${(data.escalationRate * 100).toFixed(0)}%` : "—"}</div>
        </div>
        <div className="kpi">
          <div className="kl">Open conversations</div>
          <div className="kv">{data.openConversations}</div>
        </div>
      </div>

      <div className="row">
        <div className="card">
          <h3>Recent conversations</h3>
          <div className="card-sub">Live and recently closed</div>
          {conversations.slice(0, 6).map((c) => (
            <div className="list-item" key={c.id}>
              <div className="avatar mono">{initials(c.sessionId)}</div>
              <div className="list-info">
                <div className="li-title">{subjectOf(c)}</div>
                <div className="li-sub">{latestReply(c)}</div>
              </div>
              <span className={`badge ${c.status}`}>{c.status}</span>
            </div>
          ))}
          {conversations.length === 0 && <p className="empty-note">No conversations yet.</p>}
        </div>

        <div className="card">
          <h3>Recent escalations</h3>
          <div className="card-sub">Handed off to a human</div>
          {/** The reason was its own line above a summary that restated it, so the summary carries the row. */}
          {data.recentEscalations.slice(0, 6).map((e) => (
            <div className="list-item" key={e.id}>
              <div className="list-info">
                <div className="li-title escalation-summary">{e.summary}</div>
                <div className="li-sub">{new Date(e.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
          {data.recentEscalations.length === 0 && <p className="empty-note">No escalations yet.</p>}
        </div>
      </div>

      <div className="card">
        <h3>Knowledge sources</h3>
        <div className="card-sub">Last synced status</div>
        {sources.map((s) => (
          <div className="list-item" key={s.id}>
            <div className="avatar mono">{s.type === "pdf" ? "PDF" : "HC"}</div>
            <div className="list-info">
              <div className="li-title">{s.name}</div>
              <div className="li-sub">
                {s.lastSyncedAt ? `Synced ${new Date(s.lastSyncedAt).toLocaleString()}` : "Not synced yet"}
              </div>
            </div>
            <span className={`badge ${s.lastSyncedAt ? "healthy" : "escalated"}`}>
              {s.lastSyncedAt ? "healthy" : "pending"}
            </span>
          </div>
        ))}
        {sources.length === 0 && <p className="empty-note">No sources yet.</p>}
      </div>
    </div>
  );
}
