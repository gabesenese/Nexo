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

function getSessionId(): string {
  const key = "nexo_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function Widget({ apiUrl, orgKey }: { apiUrl: string; orgKey: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [config, setConfig] = useState<{ accentColor: string; welcomeMessage: string }>({
    accentColor: "#204c40",
    welcomeMessage: GREETING,
  });
  const sessionId = useRef(getSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());

  const accent = config.accentColor;
  const escalated = status === "escalated";
  const resolved = status === "resolved";

  useEffect(() => {
    fetch(`${apiUrl}/api/widget/config?orgKey=${encodeURIComponent(orgKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (c) setConfig({ accentColor: c.accentColor, welcomeMessage: c.welcomeMessage });
      })
      .catch(() => {});
  }, [apiUrl, orgKey]);
  const headerSub = escalated
    ? "A human will follow up shortly"
    : resolved
      ? "Conversation resolved"
      : "Usually replies instantly";

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
    const id = setInterval(reconcile, 4000);
    return () => clearInterval(id);
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
        style={{
          ...styles.panel,
          opacity: open ? 1 : 0,
          transform: open ? "scale(1) translateY(0)" : "scale(0.95) translateY(10px)",
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
      >
        <div style={{ ...styles.header, background: accent }}>
          <div style={{ ...styles.mark, background: "rgba(255,255,255,0.22)" }}>N</div>
          <div style={{ flex: 1 }}>
            <div style={styles.headTitle}>Nexo Support</div>
            <div style={styles.headSub}>{headerSub}</div>
          </div>
          <button
            className="nexo-icon-btn"
            style={styles.iconButton}
            onClick={() => setOpen(false)}
            aria-label="Close"
            tabIndex={open ? 0 : -1}
          >
            ×
          </button>
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

        <div style={styles.inputRow}>
          <input
            className="nexo-input"
            style={styles.input}
            value={input}
            placeholder="Type your question…"
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
            disabled={loading}
            tabIndex={open ? 0 : -1}
          >
            →
          </button>
        </div>

        {!escalated && (
          <button
            className="nexo-human-chip"
            style={styles.humanChip}
            onClick={() => send("", true)}
            disabled={loading}
            tabIndex={open ? 0 : -1}
          >
            ↳ talk to a person instead
          </button>
        )}
      </div>

      <button
        className="nexo-launcher"
        style={{ ...styles.launcher, background: accent }}
        onClick={() => setOpen((o) => !o)}
        aria-label="Open support chat"
      >
        {open ? "×" : "Chat"}
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
  .nexo-launcher:hover { box-shadow: 0 10px 26px rgba(0,0,0,0.32); }
  .nexo-launcher:active { transform: scale(0.93); }
  .nexo-icon-btn { transition: opacity 150ms ease, transform 150ms ease-out; }
  .nexo-icon-btn:hover { opacity: 0.7; }
  .nexo-icon-btn:active { transform: scale(0.88); }
  .nexo-send-btn { transition: background 150ms ease, transform 150ms ease-out; }
  .nexo-send-btn:hover:not(:disabled) { background: ${colors.tealDark}; }
  .nexo-send-btn:active:not(:disabled) { transform: scale(0.92); }
  .nexo-human-chip { transition: background 150ms ease, border-color 150ms ease, transform 150ms ease-out; }
  .nexo-human-chip:hover:not(:disabled) { background: rgba(201,135,58,0.08); border-color: ${colors.amber}; }
  .nexo-human-chip:active:not(:disabled) { transform: scale(0.96); }
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
    .nexo-panel, .nexo-launcher, .nexo-icon-btn, .nexo-send-btn, .nexo-human-chip, .nexo-input { transition-duration: 1ms !important; }
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
    borderRadius: 999,
    width: 56,
    height: 56,
    background: colors.ink,
    color: colors.paper,
    border: "none",
    fontFamily: sans,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
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
  headSub: { fontSize: 11, color: "#9aa0a3" },
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
  inputRow: { display: "flex", gap: 8, padding: "12px 14px", borderTop: `1px solid ${colors.line}`, background: colors.white },
  input: {
    flex: 1,
    border: `1px solid ${colors.line}`,
    borderRadius: 20,
    padding: "9px 14px",
    fontSize: 12.5,
    fontFamily: sans,
    outline: "none",
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
    fontSize: 14,
  },
  humanChip: {
    alignSelf: "flex-start",
    margin: "0 14px 14px",
    fontFamily: mono,
    fontSize: 10.5,
    color: colors.amber,
    background: "transparent",
    border: `1px dashed ${colors.amber}`,
    padding: "6px 12px",
    borderRadius: 12,
    cursor: "pointer",
  },
};
