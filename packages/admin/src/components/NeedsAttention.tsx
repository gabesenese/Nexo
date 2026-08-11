import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AttentionItem, type AuthUser } from "../api";
import { subscribeToUpdates } from "../realtime";

/** The realtime stream drives updates; this only covers a stream that never connected. */
const FALLBACK_REFRESH_MS = 60000;

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

function detail(item: AttentionItem) {
  if (item.type === "reopened") return "The customer raised this again on a resolved conversation";
  if (item.type === "customer_replied") return "Waiting on your follow-up";
  return item.reason === "user_requested"
    ? "Escalated on request"
    : "Escalated on low confidence, possible knowledge gap";
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

  return (
    <div className="card attention-card">
      <div className="attention-head">
        <h3>Needs attention</h3>
        <div className="attention-head-right">
          <div className="attention-filter" role="group" aria-label="Filter by owner">
            <button className={mineOnly ? "" : "on"} onClick={() => setMineOnly(false)}>
              Everyone
            </button>
            <button className={mineOnly ? "on" : ""} onClick={() => setMineOnly(true)}>
              Mine {mineCount > 0 && <span className="filter-count">{mineCount}</span>}
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

      {visible.map((item) => (
        <div
          className="list-item attention-item"
          key={item.conversationId}
          data-clickable
          onClick={() => navigate(`/conversations?id=${item.conversationId}`)}
        >
          <span className={`attention-dot ${item.type}`} aria-hidden="true" />
          <div className="list-info">
            <div className="li-title">
              {headline(item)}
              {item.reopenCount > 0 && (
                <span className="recurrence-tag">{recurrenceLabel(item.reopenCount)}</span>
              )}
            </div>
            <div className="li-sub attention-preview">{item.preview}</div>
            <div className="attention-meta">
              {detail(item)} · waiting {waitedFor(item.since)} ·{" "}
              <span className={item.assignee ? "owner-set" : "owner-none"}>{ownerLabel(item, me?.id)}</span>
            </div>
          </div>
          <span className="attention-action">{actionLabel(item)} →</span>
        </div>
      ))}
    </div>
  );
}
