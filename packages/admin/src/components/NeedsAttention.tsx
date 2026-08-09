import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AttentionItem } from "../api";

const REFRESH_MS = 10000;

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
  if (item.type === "customer_replied") return "Customer replied after handoff";
  return item.reason === "user_requested" ? "Customer asked for a person" : "Nexo could not answer";
}

function detail(item: AttentionItem) {
  if (item.type === "customer_replied") return "Waiting on your follow-up";
  return item.reason === "user_requested"
    ? "Escalated on request"
    : "Escalated on low confidence, possible knowledge gap";
}

function actionLabel(item: AttentionItem) {
  return item.type === "customer_replied" ? "Reply" : "Open conversation";
}

export function NeedsAttention() {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const next = await api.getAttention().catch(() => null);
      if (!cancelled && next) setItems(next);
    }
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!items) return null;

  return (
    <div className="card attention-card">
      <div className="attention-head">
        <h3>Needs attention</h3>
        <span className={`attention-count${items.length === 0 ? " clear" : ""}`}>
          {items.length === 0
            ? "All clear"
            : `${items.length} ${items.length === 1 ? "conversation" : "conversations"}`}
        </span>
      </div>

      {items.length === 0 && (
        <p className="empty-note">
          No one is waiting on a human right now. New escalations show up here.
        </p>
      )}

      {items.map((item) => (
        <div
          className="list-item attention-item"
          key={item.conversationId}
          data-clickable
          onClick={() => navigate(`/conversations?id=${item.conversationId}`)}
        >
          <span className={`attention-dot ${item.type}`} aria-hidden="true" />
          <div className="list-info">
            <div className="li-title">{headline(item)}</div>
            <div className="li-sub attention-preview">{item.preview}</div>
            <div className="attention-meta">
              {detail(item)} · waiting {waitedFor(item.since)}
            </div>
          </div>
          <span className="attention-action">{actionLabel(item)} →</span>
        </div>
      ))}
    </div>
  );
}
