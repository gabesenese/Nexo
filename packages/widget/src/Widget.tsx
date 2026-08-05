import { useEffect, useRef, useState } from "react";

interface Citation {
  id: string;
  sourceName: string;
  headingPath: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  escalated?: boolean;
}

interface ChatApiResponse {
  conversationId: string;
  answer: string;
  confidence: number | null;
  citations: Citation[];
  escalated: boolean;
}

function getSessionId(): string {
  const key = "nexo_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function Widget({ apiUrl }: { apiUrl: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! Ask me anything. I'll cite my sources, and you can talk to a human any time." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionId = useRef(getSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  async function send(message: string, forceEscalate = false) {
    if (!message.trim() && !forceEscalate) return;
    setMessages((prev) => [...prev, { role: "user", content: forceEscalate ? "Talk to a human" : message }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, message: message || "Talk to a human", forceEscalate }),
      });
      const data: ChatApiResponse = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations, escalated: data.escalated },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong reaching the support agent." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      {open && (
        <div style={styles.panel}>
          <div style={styles.header}>
            <span>Nexo Support</span>
            <button style={styles.iconButton} onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>

          <div style={styles.messages} ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} style={m.role === "user" ? styles.userBubble : styles.assistantBubble}>
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
                {m.escalated && <div style={styles.escalatedNote}>A human agent has been looped in.</div>}
              </div>
            ))}
            {loading && <div style={styles.assistantBubble}>...</div>}
          </div>

          <div style={styles.inputRow}>
            <input
              style={styles.input}
              value={input}
              placeholder="Type your question..."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send(input);
              }}
            />
            <button style={styles.sendButton} onClick={() => send(input)} disabled={loading}>
              Send
            </button>
          </div>

          <button style={styles.humanButton} onClick={() => send("", true)} disabled={loading}>
            Talk to a human
          </button>
        </div>
      )}

      <button style={styles.launcher} onClick={() => setOpen((o) => !o)} aria-label="Open support chat">
        {open ? "×" : "Chat"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 999999,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  launcher: {
    borderRadius: 999,
    width: 56,
    height: 56,
    background: "#111827",
    color: "#fff",
    border: "none",
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
  },
  panel: {
    width: 340,
    height: 460,
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    marginBottom: 12,
    overflow: "hidden",
  },
  header: {
    background: "#111827",
    color: "#fff",
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 14,
    fontWeight: 600,
  },
  iconButton: {
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: 18,
    cursor: "pointer",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "#f9fafb",
  },
  userBubble: {
    alignSelf: "flex-end",
    background: "#2563eb",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 10,
    maxWidth: "80%",
    fontSize: 13,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    background: "#fff",
    border: "1px solid #e5e7eb",
    color: "#111827",
    padding: "8px 12px",
    borderRadius: 10,
    maxWidth: "85%",
    fontSize: 13,
  },
  citations: { marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 },
  citationBadge: {
    fontSize: 10,
    background: "#eef2ff",
    color: "#3730a3",
    padding: "2px 6px",
    borderRadius: 999,
  },
  escalatedNote: { marginTop: 6, fontSize: 11, color: "#b45309" },
  inputRow: { display: "flex", borderTop: "1px solid #e5e7eb" },
  input: {
    flex: 1,
    border: "none",
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
  },
  sendButton: {
    border: "none",
    background: "#111827",
    color: "#fff",
    padding: "0 16px",
    cursor: "pointer",
    fontSize: 13,
  },
  humanButton: {
    border: "none",
    borderTop: "1px solid #e5e7eb",
    background: "#fff",
    color: "#2563eb",
    padding: "8px 12px",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 600,
  },
};
