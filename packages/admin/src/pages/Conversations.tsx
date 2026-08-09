import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type Conversation, type OrgMember } from "../api";

function initials(sessionId: string) {
  return sessionId.slice(0, 2).toUpperCase();
}

function recurrenceLabel(count: number) {
  return count === 1 ? "Reopened once" : `Reopened ${count} times`;
}

/**
 * The reopen marker sits before the first message that arrived after the most
 * recent reopen, which is the customer's returning message.
 */
function reopenMarkerId(conversation: Conversation): string | null {
  if (!conversation.lastReopenedAt) return null;
  const reopenedAt = new Date(conversation.lastReopenedAt).getTime();
  const first = conversation.messages.find((m) => new Date(m.createdAt).getTime() >= reopenedAt);
  return first?.id ?? null;
}

export function ConversationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("id"));
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setConversations(await api.listConversations());
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api.getOrg().then((org) => setMembers(org.members)).catch(() => {});
  }, []);

  /** Deep-link support: a notification click sets ?id=, which may arrive after this page has already mounted. */
  useEffect(() => {
    const linkedId = searchParams.get("id");
    if (linkedId && linkedId !== selectedId) {
      setSelectedId(linkedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function selectConversation(id: string) {
    setSelectedId(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("id", id);
      return next;
    });
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const markerId = selected ? reopenMarkerId(selected) : null;

  async function handleSend() {
    const text = replyText.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.replyToConversation(selected.id, text);
      setReplyText("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleAssign(userId: string) {
    if (!selected) return;
    setError(null);
    try {
      await api.assignConversation(selected.id, userId || null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleResolve() {
    if (!selected) return;
    setError(null);
    try {
      await api.resolveConversation(selected.id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

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
              onClick={() => selectConversation(c.id)}
            >
              <div className="avatar mono">{initials(c.sessionId)}</div>
              <div className="list-info">
                <div className="li-title">
                  {c.sessionId.slice(0, 8)}…
                  {c.reopenCount > 0 && <span className="recurrence-tag">{recurrenceLabel(c.reopenCount)}</span>}
                </div>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3>Transcript</h3>
              <span className={`badge ${selected.status}`}>{selected.status}</span>
            </div>
            <div className="card-sub">
              {selected.sessionId.slice(0, 8)}… · {selected.channel}
              {selected.reopenCount > 0 && ` · ${recurrenceLabel(selected.reopenCount).toLowerCase()}`}
            </div>

            <div className="assign-row">
              <label htmlFor="assignee">Owner</label>
              <select
                id="assignee"
                className="assign-select"
                value={selected.assignedUserId ?? ""}
                onChange={(e) => handleAssign(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            {selected.messages.map((m) => (
              <Fragment key={m.id}>
                {m.id === markerId && (
                  <div className="reopen-marker">
                    <span>
                      Reopened {new Date(selected.lastReopenedAt!).toLocaleString()}, after this was resolved
                    </span>
                  </div>
                )}
                <div className={`msg ${m.role === "user" ? "user" : m.role === "agent" ? "agent" : "bot"}`}>
                  {m.role === "agent" && <div className="msg-author">You</div>}
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
              </Fragment>
            ))}

            {selected.status === "resolved" ? (
              <p className="empty-note" style={{ marginTop: 14 }}>This conversation is resolved.</p>
            ) : (
              <div className="reply-box">
                <textarea
                  className="reply-input"
                  placeholder="Type your reply to the customer…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
                  }}
                  rows={3}
                />
                {error && <p className="error-text">{error}</p>}
                <div className="reply-actions">
                  <button className="btn-small" onClick={handleResolve}>
                    Resolve
                  </button>
                  <button className="btn btn-primary" onClick={handleSend} disabled={sending || !replyText.trim()}>
                    {sending ? "Sending…" : "Send reply"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
