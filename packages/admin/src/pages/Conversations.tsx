import { useEffect, useState } from "react";
import { api, type Conversation } from "../api";

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);

  useEffect(() => {
    api.listConversations().then(setConversations);
  }, []);

  return (
    <div>
      <h1>Conversations</h1>
      <div style={{ display: "flex", gap: 16 }}>
        <div className="card" style={{ flex: 1 }}>
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Status</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((c) => (
                <tr key={c.id} onClick={() => setSelected(c)} style={{ cursor: "pointer" }}>
                  <td>{c.sessionId.slice(0, 8)}…</td>
                  <td>
                    <span className={`badge ${c.status}`}>{c.status}</span>
                  </td>
                  <td>{new Date(c.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {conversations.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ color: "#6b7280" }}>
                    No conversations yet. Try the widget demo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="card" style={{ flex: 1 }}>
            <h3>Transcript</h3>
            {selected.messages.map((m) => (
              <p key={m.id}>
                <strong>{m.role}:</strong> {m.content}
                {m.confidence != null && (
                  <span style={{ color: "#6b7280", fontSize: 12 }}> (confidence {m.confidence.toFixed(2)})</span>
                )}
              </p>
            ))}
            {selected.escalations.length > 0 && (
              <>
                <h4>Escalations</h4>
                {selected.escalations.map((e) => (
                  <p key={e.id} style={{ fontSize: 13 }}>
                    {e.reason}: {e.summary}
                  </p>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
