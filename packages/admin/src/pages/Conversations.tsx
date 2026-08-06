import { useEffect, useState } from "react";
import { api, type Conversation } from "../api";

function initials(sessionId: string) {
  return sessionId.slice(0, 2).toUpperCase();
}

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api.listConversations().then(setConversations);
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      <div className="page-top">
        <div>
          <h1>Conversations</h1>
        </div>
      </div>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="card">
          <h3>All conversations</h3>
          <div className="card-sub">{conversations.length} total</div>
          {conversations.map((c) => (
            <div
              className={`list-item${c.id === selectedId ? " selected" : ""}`}
              key={c.id}
              data-clickable
              onClick={() => setSelectedId(c.id)}
            >
              <div className="avatar mono">{initials(c.sessionId)}</div>
              <div className="list-info">
                <div className="li-title">{c.sessionId.slice(0, 8)}…</div>
                <div className="li-sub">{new Date(c.createdAt).toLocaleString()}</div>
              </div>
              <span className={`badge ${c.status}`}>{c.status}</span>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="empty-note">No conversations yet. Try the widget demo.</p>
          )}
        </div>

        {selected && (
          <div className="card">
            <h3>Transcript</h3>
            <div className="card-sub">{selected.sessionId.slice(0, 8)}… · {selected.channel}</div>
            {selected.messages.map((m) => (
              <div key={m.id} className={`msg ${m.role === "user" ? "user" : "bot"}`}>
                {m.content}
                {m.citations && m.citations.length > 0 && (
                  <div>
                    {m.citations.map((c) => (
                      <span className="cite" key={c.id}>
                        {c.sourceName}
                      </span>
                    ))}
                  </div>
                )}
                {m.confidence != null && (
                  <div style={{ fontSize: 11, color: "var(--slate-soft)", marginTop: 6 }}>
                    confidence {m.confidence.toFixed(2)}
                  </div>
                )}
              </div>
            ))}
            {selected.escalations.length > 0 && (
              <>
                <h4 style={{ fontSize: 13, marginTop: 18, marginBottom: 8 }}>Escalations</h4>
                {selected.escalations.map((e) => (
                  <div className="escalation-note" key={e.id}>
                    <strong>{e.reason.replace(/_/g, " ")}</strong> — {e.summary}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
