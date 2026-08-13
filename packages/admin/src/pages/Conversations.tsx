import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, can, type AuthUser, type Conversation, type Escalation, type Message, type OrgMember } from "../api";
import { subscribeToUpdates } from "../realtime";
import { Select } from "../components/Select";

/** The realtime stream drives updates; this only covers a stream that never connected. */
const FALLBACK_REFRESH_MS = 30000;

/**
 * The queue an operator actually works: what is open, what is on them, what
 * nobody has picked up. "Resolved" is last because it is the archive, not work.
 */
type Filter = "open" | "mine" | "unassigned" | "escalated" | "resolved" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "mine", label: "Mine" },
  { id: "unassigned", label: "Unassigned" },
  { id: "escalated", label: "Escalated" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

function initials(sessionId: string) {
  return sessionId.slice(0, 2).toUpperCase();
}

function recurrenceLabel(count: number) {
  return count === 1 ? "Reopened once" : `Reopened ${count} times`;
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The list used to be labelled with a truncated session id, which told an
 * operator nothing about what the person wanted. The customer's opening
 * question is the only label that lets someone triage a queue at a glance.
 */
function subjectOf(conversation: Conversation): string {
  const firstFromCustomer = conversation.messages.find((m) => m.role === "user");
  return firstFromCustomer?.content.trim() || "No message yet";
}

function lastMessage(conversation: Conversation): Message | null {
  return conversation.messages[conversation.messages.length - 1] ?? null;
}

function previewOf(conversation: Conversation): string {
  const last = lastMessage(conversation);
  if (!last) return "";
  const who = last.role === "user" ? "Customer" : last.role === "agent" ? "You" : "Nexo";
  return `${who}: ${last.content.trim()}`;
}

const REASON_LABELS: Record<string, string> = {
  low_confidence: "Nexo was not confident enough to answer",
  user_requested: "The customer asked for a person",
  agent_requested: "An operator flagged this for a human",
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

/** The handoff that is still open, falling back to the most recent one for resolved threads. */
function activeEscalation(conversation: Conversation) {
  return (
    conversation.escalations.find((e) => e.status === "pending") ??
    conversation.escalations[conversation.escalations.length - 1] ??
    null
  );
}

/**
 * What the customer asked when the handoff happened. Escalations recorded
 * before the question was captured have none, so it falls back to their last
 * message before that moment rather than showing nothing or inventing a label.
 */
function triggeringQuestion(conversation: Conversation, escalation: Escalation): string | null {
  if (escalation.question) return escalation.question;
  const at = new Date(escalation.createdAt).getTime();
  const before = conversation.messages.filter(
    (m) => m.role === "user" && new Date(m.createdAt).getTime() <= at,
  );
  return before[before.length - 1]?.content.trim() ?? null;
}

/** Every source Nexo cited in this thread, deduplicated, so the operator sees what it read. */
function knowledgeUsed(conversation: Conversation): string[] {
  const names = new Set<string>();
  for (const message of conversation.messages) {
    for (const citation of message.citations ?? []) names.add(citation.sourceName);
  }
  return [...names];
}

/** Waiting on a person: the customer spoke last, or a handoff is still pending. */
function needsReply(conversation: Conversation): boolean {
  if (conversation.status === "resolved") return false;
  if (conversation.escalations.some((e) => e.status === "pending")) return true;
  return lastMessage(conversation)?.role === "user";
}

function matchesFilter(conversation: Conversation, filter: Filter, meId?: string): boolean {
  if (filter === "all") return true;
  if (filter === "resolved") return conversation.status === "resolved";
  if (filter === "escalated") return conversation.status === "escalated";
  if (filter === "open") return conversation.status !== "resolved";
  if (filter === "mine") return conversation.assignedUserId === meId && conversation.status !== "resolved";
  return conversation.status !== "resolved" && !conversation.assignedUserId;
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
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [me, setMe] = useState<AuthUser | null>(null);
  const canReply = can(me, "conversations:write");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftMeta, setDraftMeta] = useState<{ confidence: number | null; sources: number } | null>(null);

  async function refresh() {
    setConversations(await api.listConversations());
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, FALLBACK_REFRESH_MS);
    const unsubscribe = subscribeToUpdates(["conversations"], refresh);
    return () => {
      clearInterval(id);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    api.getOrg().then((org) => setMembers(org.members)).catch(() => {});
    api.me().then(setMe).catch(() => {});
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
    setReplyText("");
    setDraftMeta(null);
    setError(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("id", id);
      return next;
    });
  }

  const counts = useMemo(() => {
    const of = (f: Filter) => conversations.filter((c) => matchesFilter(c, f, me?.id)).length;
    return {
      open: of("open"),
      mine: of("mine"),
      unassigned: of("unassigned"),
      escalated: of("escalated"),
      resolved: of("resolved"),
      all: conversations.length,
    };
  }, [conversations, me]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (!matchesFilter(c, filter, me?.id)) return false;
      if (!needle) return true;
      return (
        c.sessionId.toLowerCase().includes(needle) ||
        c.messages.some((m) => m.content.toLowerCase().includes(needle))
      );
    });
  }, [conversations, filter, query, me]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const markerId = selected ? reopenMarkerId(selected) : null;

  /**
   * Landing on an empty reading pane wastes the operator's first move, so the
   * top of the current filter opens by itself. A deep link still wins, since
   * `selectedId` is already set by the time this runs.
   */
  useEffect(() => {
    if (selected || visible.length === 0) return;
    setSelectedId(visible[0].id);
  }, [selected, visible]);

  async function handleSend() {
    const text = replyText.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.replyToConversation(selected.id, text);
      setReplyText("");
      setDraftMeta(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  /**
   * Fills the composer with a Nexo-suggested reply for the operator to edit or
   * send. It's only ever a starting point. Nothing reaches the customer until
   * the operator presses Send, and anything already typed is confirmed before
   * being replaced.
   */
  async function handleDraft() {
    if (!selected || drafting || sending) return;
    if (replyText.trim() && !window.confirm("Replace what you've written with a draft from Nexo?")) return;
    setDrafting(true);
    setError(null);
    try {
      const suggestion = await api.draftReply(selected.id);
      setReplyText(suggestion.draft);
      setDraftMeta({ confidence: suggestion.confidence, sources: suggestion.citations.length });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDrafting(false);
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

  /** One click to take ownership, rather than hunting for your own name in a picker. */
  async function handleClaim() {
    if (!selected || !me) return;
    await handleAssign(me.id);
  }

  async function handleReopen() {
    if (!selected) return;
    setError(null);
    try {
      await api.reopenConversation(selected.id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleAddNote() {
    const text = noteText.trim();
    if (!text || !selected || savingNote) return;
    setSavingNote(true);
    setError(null);
    try {
      await api.addNote(selected.id, text);
      setNoteText("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleEscalate() {
    if (!selected) return;
    setError(null);
    try {
      await api.escalateConversation(selected.id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <div className="page-top">
        <div>
          <h1>Inbox</h1>
          <p className="sub">Everything Nexo is handling, and everything still waiting on a person.</p>
        </div>
      </div>

      {/**
       * A workspace with no conversations at all gets guidance rather than the
       * two-pane skeleton, which otherwise shows an empty queue next to an
       * empty reading pane at exactly the moment someone needs telling what to
       * do next. Filters and search only appear once there is something to filter.
       */}
      {conversations.length === 0 ? (
        <div className="card conv-onboarding">
          <h3>No conversations yet</h3>
          <p>
            Conversations land here the moment a visitor asks the widget something. Nexo answers from
            your knowledge sources, and anything it cannot answer arrives here for a person.
          </p>
          {/** Router links, not bare anchors: an anchor reloads the whole SPA and drops the session fetch. */}
          <div className="page-actions">
            <Link className="btn btn-primary" to="/settings">
              Get the widget snippet
            </Link>
            <Link className="btn btn-ghost" to="/sources">
              Add a knowledge source
            </Link>
          </div>
        </div>
      ) : (
      <div className="conv-split">
        <div className="card conv-list-card">
          <div className="conv-toolbar">
            <div className="segmented" role="group" aria-label="Filter conversations">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={filter === f.id ? "on" : ""}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                >
                  {f.label}
                  {counts[f.id] > 0 && <span className="seg-count">{counts[f.id]}</span>}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="conv-search"
              placeholder="Search messages…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search conversations"
            />
          </div>

          <div className="conv-list">
            {visible.map((c) => (
              <button
                key={c.id}
                className={`conv-row${c.id === selectedId ? " selected" : ""}`}
                onClick={() => selectConversation(c.id)}
              >
                <div className="avatar mono">{initials(c.sessionId)}</div>
                <div className="conv-row-body">
                  <div className="conv-row-top">
                    <span className="conv-subject">{subjectOf(c)}</span>
                    <span className="conv-when">{timeAgo(c.createdAt)}</span>
                  </div>
                  <div className="conv-preview">{previewOf(c)}</div>
                  <div className="conv-row-meta">
                    <span className={`badge ${c.status}`}>{c.status}</span>
                    {needsReply(c) && <span className="badge waiting">needs reply</span>}
                    {c.reopenCount > 0 && (
                      <span className="recurrence-tag">{recurrenceLabel(c.reopenCount)}</span>
                    )}
                    {c.assignedUser && <span className="conv-owner">{c.assignedUser.name}</span>}
                  </div>
                </div>
              </button>
            ))}
            {visible.length === 0 && (
              <p className="empty-note">
                {conversations.length === 0
                  ? "No conversations yet. Try the widget demo."
                  : "Nothing matches this filter."}
              </p>
            )}
          </div>
        </div>

        {selected ? (
          <div className="card conv-detail-card">
            <div className="conv-detail-head">
              <div className="conv-detail-title">
                <h3>{subjectOf(selected)}</h3>
                <div className="card-sub">
                  {selected.sessionId.slice(0, 8)}… · {selected.channel} · started{" "}
                  {new Date(selected.createdAt).toLocaleString()}
                  {selected.reopenCount > 0 &&
                    ` · ${recurrenceLabel(selected.reopenCount).toLowerCase()}`}
                </div>
              </div>
              <div className="conv-detail-controls">
                <span className={`badge ${selected.status}`}>{selected.status}</span>
                {canReply && selected.assignedUserId !== me?.id && selected.status !== "resolved" && (
                  <button className="btn-small" onClick={handleClaim}>
                    Claim
                  </button>
                )}
                {canReply ? (
                  <Select
                    className="assign-select"
                    ariaLabel="Owner"
                    value={selected.assignedUserId ?? ""}
                    onChange={handleAssign}
                    options={[
                      { value: "", label: "Unassigned" },
                      ...members.map((m) => ({ value: m.id, label: m.name })),
                    ]}
                  />
                ) : (
                  <span className="badge neutral">
                    {selected.assignedUser ? `Owned by ${selected.assignedUser.name}` : "Unassigned"}
                  </span>
                )}
              </div>
            </div>

            {/**
             * Everything the person taking over needs before they read a word
             * of the transcript: why Nexo stopped, what was asked, and which
             * sources it had. Fields with no data are omitted rather than
             * shown empty, so the panel never pads itself out.
             */}
            {(() => {
              const escalation = activeEscalation(selected);
              if (!escalation) return null;
              const asked = triggeringQuestion(selected, escalation);
              const sources = knowledgeUsed(selected);
              return (
                <div className="conv-context">
                  <div className="conv-context-head">Context for your team</div>
                  <dl className="conv-context-grid">
                    <dt>Reason</dt>
                    <dd>{reasonLabel(escalation.reason)}</dd>

                    {asked && (
                      <>
                        <dt>They asked</dt>
                        <dd className="conv-context-quote">“{asked}”</dd>
                      </>
                    )}

                    <dt>Knowledge used</dt>
                    <dd>
                      {sources.length > 0 ? (
                        <span className="conv-context-sources">
                          {sources.map((s) => (
                            <span className="cite" key={s}>
                              {s}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="conv-context-none">
                          Nothing matched, which is usually the gap itself
                        </span>
                      )}
                    </dd>

                    <dt>Handed off</dt>
                    <dd>
                      {new Date(escalation.createdAt).toLocaleString()} ·{" "}
                      {escalation.status === "pending" ? "still waiting" : "picked up"}
                    </dd>
                  </dl>
                  <p className="conv-context-summary">{escalation.summary}</p>
                </div>
              );
            })()}

            {/** Team-only. Kept visually distinct so nobody mistakes it for something the customer can read. */}
            <div className="conv-notes">
              <div className="conv-notes-head">
                Internal notes
                <span className="conv-notes-hint">Only your team sees these</span>
              </div>
              {selected.notes.length > 0 && (
                <ul className="conv-note-list">
                  {selected.notes.map((n) => (
                    <li key={n.id}>
                      <span className="conv-note-body">{n.body}</span>
                      <span className="conv-note-meta">
                        {n.author?.name ?? "Someone"} · {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {canReply && (
              <div className="field-inline">
                <input
                  type="text"
                  value={noteText}
                  placeholder="Leave a note for your team…"
                  aria-label="Add an internal note"
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddNote();
                  }}
                />
                <button className="btn-small" onClick={handleAddNote} disabled={savingNote || !noteText.trim()}>
                  {savingNote ? "Saving…" : "Add note"}
                </button>
              </div>
              )}
            </div>

            <div className="conv-transcript">
              {selected.messages.map((m) => (
                <Fragment key={m.id}>
                  {m.id === markerId && (
                    <div className="reopen-marker">
                      <span>
                        Reopened {new Date(selected.lastReopenedAt!).toLocaleString()}, after this was
                        resolved
                      </span>
                    </div>
                  )}
                  <div
                    className={`msg ${m.role === "user" ? "user" : m.role === "agent" ? "agent" : "bot"}`}
                  >
                    {m.role === "agent" && <div className="msg-author">You</div>}
                    {m.content}
                    {m.citations && m.citations.length > 0 && (
                      <div className="msg-cites">
                        {m.citations.map((c) => (
                          <span className="cite" key={c.id}>
                            {c.sourceName}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.confidence != null && (
                      <div className="msg-confidence">confidence {m.confidence.toFixed(2)}</div>
                    )}
                  </div>
                </Fragment>
              ))}
            </div>

            {!canReply ? (
              /**
               * A Viewer can read the thread and the context block, and cannot
               * act on it. Saying so beats a disabled reply box, which reads as
               * something broken rather than something they lack.
               */
              <div className="conv-resolved-note">
                <span className="empty-note">
                  Your role is read-only. Ask an agent or admin to reply to this conversation.
                </span>
              </div>
            ) : selected.status === "resolved" ? (
              <div className="conv-resolved-note">
                <span className="empty-note">This conversation is resolved.</span>
                <button className="btn-small" onClick={handleReopen}>
                  Reopen
                </button>
              </div>
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
                  <span className="reply-hint">
                    {draftMeta ? (
                      <>
                        Drafted by Nexo
                        {draftMeta.confidence != null && ` · ${Math.round(draftMeta.confidence * 100)}% confidence`}
                        {draftMeta.sources > 0 &&
                          ` · ${draftMeta.sources} ${draftMeta.sources === 1 ? "source" : "sources"}`}
                        . Edit before sending.
                      </>
                    ) : (
                      "Ctrl + Enter to send"
                    )}
                  </span>
                  <div className="page-actions">
                    <button className="btn-small" onClick={handleDraft} disabled={drafting || sending}>
                      {drafting ? "Drafting…" : "Draft with Nexo"}
                    </button>
                    {selected.status !== "escalated" && (
                      <button className="btn-small" onClick={handleEscalate}>
                        Escalate
                      </button>
                    )}
                    <button className="btn-small" onClick={handleResolve}>
                      Resolve
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSend}
                      disabled={sending || !replyText.trim()}
                    >
                      {sending ? "Sending…" : "Send reply"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card conv-detail-card conv-empty">
            <div className="conv-empty-inner">
              <h3>Select a conversation</h3>
              <p>Pick a thread on the left to read the transcript and reply.</p>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
