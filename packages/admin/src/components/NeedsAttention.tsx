import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AttentionItem, type AuthUser } from "../api";
import { subscribeToUpdates } from "../realtime";

/** The realtime stream drives updates; this only covers a stream that never connected. */
const FALLBACK_REFRESH_MS = 60000;

/** A queue this long stops reading as a queue, so the rest is one click away. */
const COLLAPSED_COUNT = 6;

function waitedFor(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function headline(item: AttentionItem) {
  if (item.type === "reopened") return "Came back after being resolved";
  if (item.type === "customer_replied") return "Customer replied after handoff";
  return item.reason === "user_requested" ? "Customer asked for a person" : "Nexo could not answer";
}

function actionLabel(item: AttentionItem) {
  if (item.type === "reopened") return "Review";
  return item.type === "customer_replied" ? "Reply" : "Open conversation";
}

function recurrenceLabel(count: number) {
  return count === 1 ? "reopened once" : `reopened ${count} times`;
}

function ownerLabel(item: AttentionItem, meId: string | undefined) {
  if (!item.assignee) return "Nobody has picked this up";
  return item.assignee.id === meId ? "Assigned to you" : `Assigned to ${item.assignee.name}`;
}

function severity(items: AttentionItem[]) {
  if (items.length === 0) return "clear";
  if (items.some((i) => i.type === "waiting_for_human")) return "urgent";
  if (items.some((i) => i.type === "customer_replied")) return "warn";
  return "muted";
}

export function NeedsAttention() {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.me().then(setMe);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const next = await api.getAttention().catch(() => null);
      if (!cancelled && next) setItems(next);
    }
    refresh();
    const id = setInterval(refresh, FALLBACK_REFRESH_MS);
    const unsubscribe = subscribeToUpdates(["attention"], refresh);
    return () => {
      cancelled = true;
      clearInterval(id);
      unsubscribe();
    };
  }, []);

  if (!items) return null;

  const mineCount = items.filter((i) => i.assignee?.id === me?.id).length;
  const visible = mineOnly ? items.filter((i) => i.assignee?.id === me?.id) : items;
  const shown = expanded ? visible : visible.slice(0, COLLAPSED_COUNT);
  const hidden = visible.length - shown.length;

  return (
    <div className="card attention-card">
      <div className="attention-head">
        <div>
          <h3>Needs attention</h3>
          <div className="card-sub">Conversations where someone is waiting on a person</div>
        </div>
        <div className="attention-head-right">
          <div className="segmented" role="group" aria-label="Filter by owner">
            <button className={mineOnly ? "" : "on"} onClick={() => setMineOnly(false)}>
              Everyone
            </button>
            <button className={mineOnly ? "on" : ""} onClick={() => setMineOnly(true)}>
              Mine {mineCount > 0 && <span className="seg-count">{mineCount}</span>}
            </button>
          </div>
          <span className={`attention-count ${severity(visible)}`}>
            {visible.length === 0
              ? "All clear"
              : `${visible.length} ${visible.length === 1 ? "conversation" : "conversations"}`}
          </span>
        </div>
      </div>

      {visible.length === 0 && (
        <p className="empty-note">
          {mineOnly
            ? "Nothing is assigned to you right now."
            : "No one is waiting on a human right now. New escalations show up here."}
        </p>
      )}

      {shown.map((item) => (
        <div
          className="list-item attention-item"
          key={item.conversationId}
          data-clickable
          onClick={() => navigate(`/conversations?id=${item.conversationId}`)}
        >
          <span className={`attention-dot ${item.type}`} aria-hidden="true" />
          <div className="list-info">
            {/**
             * The customer's own words lead. The reason it landed here is
             * useful context, but it repeats across most rows, so as a title it
             * made eighteen different problems look like one.
             */}
            <div className="li-title attention-question">
              {item.preview}
              {item.reopenCount > 0 && (
                <span className="recurrence-tag">{recurrenceLabel(item.reopenCount)}</span>
              )}
            </div>
            {/** The reason used to appear twice per row in two phrasings, which read as noise once stacked. */}
            <div className="attention-meta">
              <span className="attention-reason">{headline(item)}</span> · waiting {waitedFor(item.since)} ·{" "}
              <span className={item.assignee ? "owner-set" : "owner-none"}>{ownerLabel(item, me?.id)}</span>
            </div>
          </div>
          <span className="attention-action">{actionLabel(item)} →</span>
        </div>
      ))}

      {hidden > 0 && (
        <button className="attention-more" onClick={() => setExpanded(true)}>
          Show {hidden} more
        </button>
      )}
      {expanded && visible.length > COLLAPSED_COUNT && (
        <button className="attention-more" onClick={() => setExpanded(false)}>
          Show less
        </button>
      )}
    </div>
  );
}
