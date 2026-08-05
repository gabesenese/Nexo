import { useEffect, useState } from "react";
import { api, type AnalyticsSummary } from "../api";

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    api.getAnalytics().then(setData);
  }, []);

  if (!data) return <p>Loading…</p>;

  return (
    <div>
      <h1>Analytics</h1>
      <div className="stat-row">
        <div className="stat">
          <div className="value">{data.totalConversations}</div>
          <div className="label">Total conversations</div>
        </div>
        <div className="stat">
          <div className="value">{(data.resolutionRate * 100).toFixed(0)}%</div>
          <div className="label">Resolution rate</div>
        </div>
        <div className="stat">
          <div className="value">{(data.escalationRate * 100).toFixed(0)}%</div>
          <div className="label">Escalation rate</div>
        </div>
      </div>

      <div className="card">
        <h3>Recent escalations</h3>
        <table>
          <thead>
            <tr>
              <th>Reason</th>
              <th>Summary</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.recentEscalations.map((e) => (
              <tr key={e.id}>
                <td>{e.reason}</td>
                <td>{e.summary}</td>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {data.recentEscalations.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: "#6b7280" }}>
                  No escalations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p style={{ color: "#6b7280", fontSize: 13 }}>
        Confusion-report clustering (grouping unresolved conversations by topic) is a Phase 2 item per the
        project plan, not built in this pass.
      </p>
    </div>
  );
}
