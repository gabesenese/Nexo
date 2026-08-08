import { useMemo, useRef, useState } from "react";
import { api, type ChatReply } from "../../api";
import { WizardShell } from "../WizardShell";

interface ChatMessage {
  role: "user" | "bot";
  content: string;
  citations?: { id: string; sourceName: string }[];
  escalated?: boolean;
}

export function TestNexoStep({
  orgKey,
  hasKnowledge,
  onNext,
}: {
  orgKey: string;
  hasKnowledge: boolean;
  onNext: () => void;
}) {
  const sessionId = useMemo(() => `onboard-${crypto.randomUUID()}`, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [answered, setAnswered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(message: string) {
    const text = message.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const reply: ChatReply = await api.chat({ orgKey, sessionId, message: text });
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: reply.answer,
          citations: reply.citations.map((c) => ({ id: c.id, sourceName: c.sourceName })),
          escalated: reply.escalated,
        },
      ]);
      setAnswered(true);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "bot", content: (err as Error).message }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
  }

  return (
    <WizardShell
      step={5}
      total={7}
      title="Ask Nexo a real question"
      subtitle={
        hasKnowledge
          ? "This is your live assistant, answering from the knowledge you just added."
          : "You skipped importing, so Nexo will be honest about not knowing yet. Add knowledge from the dashboard to see grounded answers."
      }
      wide
    >
      <div className="onboard-chat" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="onboard-chat-empty">Type a question your customers would ask.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
            {m.citations && m.citations.length > 0 && (
              <div className="cite">
                source{m.citations.length === 1 ? "" : "s"}: {m.citations.map((c) => c.sourceName).join(", ")}
              </div>
            )}
            {m.escalated && (
              <div className="onboard-handoff-note">Handing this to a human. They'll pick up with the full conversation.</div>
            )}
          </div>
        ))}
        {loading && <div className="msg bot onboard-chat-loading">Thinking…</div>}
      </div>

      <div className="onboard-chat-input">
        <input
          type="text"
          placeholder="e.g. What is your return policy?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
        />
        <button type="button" className="btn btn-primary" onClick={() => send(input)} disabled={loading || !input.trim()}>
          Ask
        </button>
      </div>

      <div className="onboard-actions">
        <span />
        <button type="button" className="btn btn-primary" onClick={onNext} disabled={hasKnowledge && !answered}>
          {hasKnowledge && !answered ? "Ask a question to continue" : "Continue"}
        </button>
      </div>
    </WizardShell>
  );
}
