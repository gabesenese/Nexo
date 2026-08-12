import { Fragment, useEffect, useRef, useState } from "react";

interface Citation {
  id: string;
  sourceName: string;
  headingPath: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  citations?: Citation[];
  createdAt: string;
}

const GREETING = "Hi! Ask me anything. I'll cite my sources, and you can talk to a human any time.";

/**
 * An agent's reply arrives over the event stream. This only covers a stream
 * that never connected, so it is slow on purpose: a visitor waiting on a human
 * should not be paying for a request every few seconds.
 */
const FALLBACK_POLL_MS = 20000;

/**
 * Reading localStorage throws outright on pages where storage is blocked:
 * private browsing in some browsers, sandboxed iframes, and strict
 * cookie settings all do it. Unguarded, that exception escaped during the
 * widget's first render and took the whole thing down, so a visitor on such a
 * page saw no launcher at all rather than a working chat.
 *
 * Falling back to an id that lives only in memory keeps the conversation
 * working for this page load. It will not survive a refresh, which is a far
 * better failure than no support widget.
 */
function getSessionId(): string {
  const key = "nexo_session_id";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Stands in for a logo until organisations can upload one. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase() || "S";
}

export function Widget({ apiUrl, orgKey }: { apiUrl: string; orgKey: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  /**
   * The widget sits on the customer's own website talking to their customers,
   * so it wears their name, not ours. `/api/widget/config` has always returned
   * `organizationName` and the widget ignored it in favour of a hardcoded
   * "Nexo Support", which showed our brand to businesses paying to put theirs
   * in front of their visitors. Nexo is credited once, quietly, in the footer.
   */
  const [config, setConfig] = useState<{
    organizationName: string;
    accentColor: string;
    welcomeMessage: string;
  }>({
    organizationName: "Support",
    accentColor: "#204c40",
    welcomeMessage: GREETING,
  });
  const sessionId = useRef(getSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accent = config.accentColor;
  const escalated = status === "escalated";
  const resolved = status === "resolved";

  useEffect(() => {
    fetch(`${apiUrl}/api/widget/config?orgKey=${encodeURIComponent(orgKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (c) {
          setConfig({
            organizationName: c.organizationName || "Support",
            accentColor: c.accentColor,
            welcomeMessage: c.welcomeMessage,
          });
        }
      })
      .catch(() => {});
  }, [apiUrl, orgKey]);

  const headerSub = escalated
    ? "A person is joining you"
    : resolved
      ? "Conversation resolved"
      : "Usually replies instantly";

  /** Opening a chat should put the caret where the person is about to type. */
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /** Escape closes the panel, which is what every other overlay on the web does. */
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, loading, open]);

  /**
   * Fetches the whole thread and lets `seen` decide what is new, rather than
   * asking for messages after the newest timestamp already held. A timestamp
   * cursor loses messages outright: the database stamps a row when the insert
   * runs but the row only becomes visible when it commits, so an operator's
   * reply written alongside an AI answer can commit second while carrying the
   * earlier timestamp. The cursor moves past it and that reply is never
   * requested again. A support thread is small enough that refetching it is
   * cheaper than a customer never seeing an answer.
   */
  async function reconcile() {
    const qs = new URLSearchParams({ orgKey, sessionId: sessionId.current });
    try {
      const res = await fetch(`${apiUrl}/api/chat/messages?${qs.toString()}`);
      if (!res.ok) return;
      const data: { status: string | null; messages: ChatMessage[] } = await res.json();
      if (data.status) setStatus(data.status);
      const fresh = data.messages.filter((m) => !seen.current.has(m.id));
      if (fresh.length === 0) return;
      fresh.forEach((m) => seen.current.add(m.id));
      setMessages((prev) => [...prev, ...fresh]);
    } catch {
      /* transient; next poll retries */
    }
  }

  useEffect(() => {
    if (!open) return;
    reconcile();
    const id = setInterval(reconcile, FALLBACK_POLL_MS);

    const qs = new URLSearchParams({ orgKey, sessionId: sessionId.current });
    const stream = new EventSource(`${apiUrl}/api/chat/events?${qs.toString()}`);
    stream.onmessage = () => {
      reconcile();
    };

    return () => {
      clearInterval(id);
      stream.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function send(message: string, forceEscalate = false) {
    if (!message.trim() && !forceEscalate) return;
    setPending(forceEscalate ? "Talk to a human" : message);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, orgKey, message: message || "Talk to a human", forceEscalate }),
      });
      /**
       * fetch only rejects on network failure, so a refused request lands here
       * rather than in the catch. The server stored nothing, so the transcript
       * has to keep the visitor's own message too. Dropping it would leave them
       * staring at a refusal with no record of what they asked, and retyping it.
       */
      if (!res.ok) {
        const now = Date.now();
        setMessages((prev) => [
          ...prev,
          {
            id: `sent-${now}`,
            role: "user",
            content: message || "Talk to a human",
            createdAt: new Date().toISOString(),
          },
          {
            id: `err-${now}`,
            role: "assistant",
            /** Deliberately says nothing about the account: that is between us and the business. */
            content:
              res.status === 402
                ? "Support is unavailable right now. Please try again later."
                : "Sorry, something went wrong reaching support.",
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }
      await reconcile();
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: "Sorry, something went wrong reaching support.", createdAt: new Date().toISOString() },
      ]);
    } finally {
      setPending(null);
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      <style>{css}</style>

      <div
        className="nexo-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={`${config.organizationName} support chat`}
        style={{
          ...styles.panel,
          opacity: open ? 1 : 0,
          transform: open ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
      >
        <div style={{ ...styles.header, background: accent }}>
          <div style={{ ...styles.mark, background: "rgba(255,255,255,0.22)" }}>
            {initialsOf(config.organizationName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.headTitle}>{config.organizationName} Support</div>
            <div style={styles.headSub}>
              <span
                style={{
                  ...styles.statusDot,
                  background: escalated ? "#f0c274" : resolved ? "rgba(255,255,255,0.4)" : "#7fd4a8",
                }}
                aria-hidden="true"
              />
              {headerSub}
            </div>
          </div>
          <button
            className="nexo-icon-btn"
            style={styles.iconButton}
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            tabIndex={open ? 0 : -1}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M3.5 3.5l7 7m0-7l-7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/** Status changes are announced without stealing focus from the input. */}
        <div style={styles.srOnly} role="status" aria-live="polite">
          {escalated
            ? "A support specialist is joining the conversation."
            : resolved
              ? "This conversation has been resolved."
              : ""}
        </div>

        <div style={styles.messages} ref={scrollRef}>
          <div className="nexo-msg-enter" style={styles.assistantBubble}>
            <div>{config.welcomeMessage}</div>
          </div>
          {messages.map((m, i) => {
            const firstAgent = m.role === "agent" && messages.findIndex((x) => x.role === "agent") === i;
            return (
              <Fragment key={m.id}>
                {firstAgent && <div style={styles.joinNote}>A support specialist has joined this conversation</div>}
                <div
                  className="nexo-msg-enter"
                  style={
                    m.role === "user"
                      ? styles.userBubble
                      : m.role === "agent"
                        ? { ...styles.agentBubble, borderColor: accent }
                        : styles.assistantBubble
                  }
                >
                  {m.role === "agent" && <div style={{ ...styles.agentLabel, color: accent }}>● Support specialist</div>}
                  <div>{m.content}</div>
                  {m.citations && m.citations.length > 0 && (
                    <div style={styles.citations}>
                      {m.citations.map((c) => (
                        <span key={c.id} style={styles.citationBadge} title={c.headingPath.join(" > ")}>
                          {c.sourceName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
          {pending && (
            <div className="nexo-msg-enter" style={styles.userBubble}>
              <div>{pending}</div>
            </div>
          )}
          {loading && (
            <div className="nexo-msg-enter" style={styles.assistantBubble}>
              <span className="nexo-typing">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          )}
          {escalated && !messages.some((m) => m.role === "agent") && (
            <div className="nexo-msg-enter" style={styles.handoffSummary}>
              <span style={styles.handoffLabel}>Connecting you with a human</span>
              A support specialist has been brought into this conversation and will reply here.
            </div>
          )}
          {resolved && (
            <div className="nexo-msg-enter" style={styles.handoffSummary}>
              <span style={styles.handoffLabel}>Conversation resolved</span>
              Our team marked this as resolved. Send a message anytime to start a new one.
            </div>
          )}
        </div>

        <div style={styles.footer}>
          {!escalated && !resolved && (
            <button
              className="nexo-human-chip"
              style={styles.humanChip}
              onClick={() => send("", true)}
              disabled={loading}
              tabIndex={open ? 0 : -1}
            >
              Talk to a person instead
            </button>
          )}
          <div style={styles.inputRow}>
            <input
              className="nexo-input"
              ref={inputRef}
              style={styles.input}
              value={input}
              placeholder="Ask a question…"
              aria-label="Type your message"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send(input);
              }}
              tabIndex={open ? 0 : -1}
            />
            <button
              className="nexo-send-btn"
              style={{ ...styles.sendButton, background: accent }}
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              tabIndex={open ? 0 : -1}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M7 11.5v-9m0 0L3.5 6M7 2.5 10.5 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {/** Nexo's only appearance. The header belongs to the business the visitor came to. */}
          <div style={styles.poweredBy}>Powered by Nexo</div>
        </div>
      </div>

      <button
        className="nexo-launcher"
        style={{ ...styles.launcher, background: accent }}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        aria-expanded={open}
      >
        <span className={`nexo-launcher-icon${open ? " is-open" : ""}`}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path
              d="M4 9.5C4 6.46 6.9 4 11 4s7 2.46 7 5.5S15.1 15 11 15c-.63 0-1.24-.06-1.81-.17L6 16.5l.86-2.35C5.13 13.14 4 11.44 4 9.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={`nexo-launcher-close${open ? " is-open" : ""}`}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M5 5l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
      </button>
    </div>
  );
}

const colors = {
  ink: "#181b1d",
  paper: "#f6f4ee",
  paperDim: "#eeebe2",
  teal: "#2f6f5e",
  tealDark: "#204c40",
  amber: "#c9873a",
  slate: "#3d4145",
  slateSoft: "#6b7075",
  line: "#dcd7c9",
  white: "#ffffff",
};

const sans = "'IBM Plex Sans', system-ui, -apple-system, sans-serif";
const mono = "'IBM Plex Mono', ui-monospace, monospace";
const serif = "'Fraunces', Georgia, serif";
const easeOut = "cubic-bezier(0.23, 1, 0.32, 1)";

const css = `
  .nexo-panel { transition: opacity 220ms ${easeOut}, transform 220ms ${easeOut}; transform-origin: bottom right; }
  .nexo-launcher { transition: transform 160ms ${easeOut}, box-shadow 160ms ease; }
  .nexo-launcher:hover { box-shadow: 0 10px 26px rgba(0,0,0,0.3); }
  .nexo-launcher:active { transform: scale(0.94); }
  /* Both glyphs are stacked and crossfaded, so the launcher never collapses to nothing between states. */
  .nexo-launcher-icon, .nexo-launcher-close {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 160ms ${easeOut}, transform 160ms ${easeOut};
  }
  .nexo-launcher-icon { opacity: 1; transform: scale(1) rotate(0deg); }
  .nexo-launcher-icon.is-open { opacity: 0; transform: scale(0.8) rotate(-25deg); }
  .nexo-launcher-close { opacity: 0; transform: scale(0.8) rotate(25deg); }
  .nexo-launcher-close.is-open { opacity: 1; transform: scale(1) rotate(0deg); }
  .nexo-launcher:focus-visible, .nexo-icon-btn:focus-visible, .nexo-send-btn:focus-visible, .nexo-human-chip:focus-visible {
    outline: 2px solid ${colors.white};
    outline-offset: 2px;
  }
  .nexo-input:focus-visible { outline: none; }
  .nexo-send-btn:disabled { opacity: 0.4; cursor: default; }
  .nexo-icon-btn { transition: opacity 150ms ease, transform 150ms ease-out; }
  .nexo-icon-btn:hover { opacity: 0.7; }
  .nexo-icon-btn:active { transform: scale(0.88); }
  .nexo-send-btn { transition: background 150ms ease, transform 150ms ease-out; }
  .nexo-send-btn:hover:not(:disabled) { background: ${colors.tealDark}; }
  .nexo-send-btn:active:not(:disabled) { transform: scale(0.92); }
  .nexo-human-chip { transition: background 150ms ease, border-color 150ms ease, color 150ms ease; }
  .nexo-human-chip:hover:not(:disabled) { border-color: ${colors.slateSoft}; color: ${colors.ink}; }
  .nexo-input { transition: border-color 150ms ease; }
  .nexo-input:focus { border-color: ${colors.teal}; }
  .nexo-msg-enter { animation: nexoMsgIn 240ms ${easeOut} both; }
  @keyframes nexoMsgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .nexo-typing { display: inline-flex; gap: 3px; align-items: center; height: 14px; }
  .nexo-typing span { width: 5px; height: 5px; border-radius: 50%; background: ${colors.slateSoft}; animation: nexoTyping 1s ease-in-out infinite; }
  .nexo-typing span:nth-child(2) { animation-delay: 0.15s; }
  .nexo-typing span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes nexoTyping { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-3px); opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .nexo-panel, .nexo-launcher, .nexo-icon-btn, .nexo-send-btn, .nexo-human-chip, .nexo-input,
    .nexo-launcher-icon, .nexo-launcher-close { transition-duration: 1ms !important; }
    .nexo-msg-enter { animation-duration: 1ms !important; }
    .nexo-typing span { animation-duration: 1ms !important; }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 999999,
    fontFamily: sans,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  launcher: {
    position: "relative",
    borderRadius: 999,
    width: 54,
    height: 54,
    background: colors.ink,
    color: colors.paper,
    border: "none",
    fontFamily: sans,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    position: "absolute",
    bottom: 68,
    right: 0,
    width: 360,
    height: 560,
    background: colors.white,
    border: `1px solid ${colors.line}`,
    borderRadius: 16,
    boxShadow: "0 20px 50px -10px rgba(0,0,0,0.3)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    background: colors.ink,
    color: colors.paper,
    padding: "16px 18px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  mark: {
    width: 22,
    height: 22,
    background: colors.teal,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: serif,
    fontSize: 12,
    flexShrink: 0,
  },
  headTitle: { fontSize: 13.5, fontWeight: 500 },
  headSub: {
    fontSize: 11,
    color: "rgba(246,244,238,0.72)",
    display: "flex",
    alignItems: "center",
    gap: 5,
    marginTop: 1,
  },
  statusDot: { width: 5, height: 5, borderRadius: "50%", flexShrink: 0 },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  footer: { background: colors.white, borderTop: `1px solid ${colors.line}` },
  poweredBy: {
    fontFamily: mono,
    fontSize: 9,
    color: "#9aa0a3",
    textAlign: "center",
    padding: "0 0 10px",
    letterSpacing: "0.04em",
  },
  iconButton: {
    background: "transparent",
    border: "none",
    color: colors.paper,
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: colors.paper,
  },
  userBubble: {
    alignSelf: "flex-end",
    background: colors.ink,
    color: colors.paper,
    padding: "10px 13px",
    borderRadius: 12,
    borderBottomRightRadius: 3,
    maxWidth: "82%",
    fontSize: 13,
    lineHeight: 1.5,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    background: colors.white,
    border: `1px solid ${colors.line}`,
    color: colors.slate,
    padding: "10px 13px",
    borderRadius: 12,
    borderBottomLeftRadius: 3,
    maxWidth: "82%",
    fontSize: 13,
    lineHeight: 1.5,
  },
  agentBubble: {
    alignSelf: "flex-start",
    background: "#eef3f1",
    border: `1px solid ${colors.teal}`,
    color: colors.slate,
    padding: "10px 13px",
    borderRadius: 12,
    borderBottomLeftRadius: 3,
    maxWidth: "82%",
    fontSize: 13,
    lineHeight: 1.5,
  },
  agentLabel: {
    fontFamily: mono,
    fontSize: 10,
    color: colors.tealDark,
    marginBottom: 5,
  },
  joinNote: {
    alignSelf: "center",
    textAlign: "center",
    fontSize: 11,
    color: colors.slateSoft,
    margin: "4px 0 8px",
  },
  citations: { marginTop: 7, display: "flex", flexWrap: "wrap", gap: 4 },
  citationBadge: {
    fontFamily: mono,
    fontSize: 10,
    background: "#e3ede9",
    color: colors.tealDark,
    padding: "2px 6px",
    borderRadius: 8,
  },
  handoffSummary: {
    alignSelf: "center",
    width: "100%",
    boxSizing: "border-box",
    background: colors.paperDim,
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 11.5,
    color: colors.slateSoft,
    lineHeight: 1.6,
  },
  handoffLabel: {
    fontFamily: mono,
    fontSize: 9.5,
    color: colors.tealDark,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
    display: "block",
  },
  inputRow: { display: "flex", gap: 8, padding: "10px 14px 8px", background: colors.white },
  input: {
    flex: 1,
    minWidth: 0,
    border: `1px solid ${colors.line}`,
    borderRadius: 20,
    padding: "9px 14px",
    fontSize: 12.5,
    fontFamily: sans,
    outline: "none",
    color: colors.slate,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "none",
    background: colors.ink,
    color: colors.paper,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  humanChip: {
    display: "block",
    width: "calc(100% - 28px)",
    margin: "10px 14px 0",
    fontFamily: sans,
    fontSize: 11.5,
    color: colors.slateSoft,
    background: colors.paper,
    border: `1px solid ${colors.line}`,
    padding: "7px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
};
