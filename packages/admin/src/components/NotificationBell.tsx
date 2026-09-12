import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Notification } from "../api";
import { subscribeToUpdates } from "../realtime";

/** The realtime stream drives updates; this only covers a stream that never connected. */
const FALLBACK_REFRESH_MS = 60000;

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  async function refresh() {
    setNotifications(await api.listNotifications());
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, FALLBACK_REFRESH_MS);
    const unsubscribe = subscribeToUpdates(["notifications"], refresh);
    return () => {
      clearInterval(id);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  /**
   * Opening the panel marks everything read, so the ids are kept here to keep
   * the dots visible while the operator is still looking at them.
   */
  const [unreadOnOpen, setUnreadOnOpen] = useState<string[]>([]);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setUnreadOnOpen(notifications.filter((n) => !n.read).map((n) => n.id));
    if (unreadCount > 0) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      await api.markNotificationsRead().catch(() => {});
    }
  }

  function handleSelect(conversationId: string) {
    setOpen(false);
    navigate(`/conversations?id=${conversationId}`);
  }

  return (
    <div className="notif-bell" ref={containerRef}>
      <button className="notif-trigger" onClick={handleToggle} aria-label="Notifications">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2.5c-2.3 0-4.2 1.9-4.2 4.2v2.4c0 .5-.2 1-.5 1.4l-1 1.3c-.5.6-.1 1.6.7 1.6h10.9c.8 0 1.2-1 .7-1.6l-1-1.3c-.3-.4-.5-.9-.5-1.4V6.7c0-2.3-1.9-4.2-4.2-4.2z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M8.3 15.8a1.8 1.8 0 0 0 3.4 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && <span className="notif-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-head">
            <span className="notif-dropdown-title">Escalations</span>
            {unreadOnOpen.length > 0 && (
              <span className="notif-dropdown-count">{unreadOnOpen.length} new</span>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 && (
              <p className="notif-empty">
                Nothing waiting. Nexo tells you here the moment it hands a conversation over.
              </p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`notif-item ${unreadOnOpen.includes(n.id) ? "fresh" : ""}`}
                onClick={() => handleSelect(n.conversationId)}
              >
                <span className="notif-message">{n.message}</span>
                <span className="notif-time">{timeAgo(n.createdAt)}</span>
              </button>
            ))}
          </div>
          {notifications.length > 0 && (
            <button type="button" className="notif-all" onClick={() => { setOpen(false); navigate("/conversations"); }}>
              Open the Inbox
            </button>
          )}
        </div>
      )}
    </div>
  );
}
