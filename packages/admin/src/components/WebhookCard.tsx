import { useEffect, useState } from "react";
import { api, type WebhookConfig } from "../api";

function when(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function WebhookCard() {
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [secretShown, setSecretShown] = useState(false);

  async function load() {
    const next = await api.getWebhook();
    setConfig(next);
    setUrl(next.configured ? next.url : "");
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      await api.saveWebhook(url.trim(), true);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const r = await api.testWebhook();
      setTestResult(
        r.status === "succeeded"
          ? `Delivered in ${r.durationMs} ms (HTTP ${r.statusCode}).`
          : `Failed after ${r.attempts} ${r.attempts === 1 ? "attempt" : "attempts"}: ${r.error}`,
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this webhook? Escalations will stop being sent to it.")) return;
    setBusy(true);
    try {
      await api.deleteWebhook();
      setTestResult(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!config) return null;

  return (
    <div className="card">
      <h3>Handoff webhook</h3>
      <div className="card-sub">
        When Nexo hands a conversation to a human, it posts the transcript, the reason, and the
        sources it used to your endpoint. Point it at your helpdesk's inbound webhook or an
        automation step in front of it.
      </div>

      <form onSubmit={save}>
        <div className="field-row">
          <label htmlFor="wh-url">Endpoint URL</label>
          <div className="field-control">
            <input
              id="wh-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.example.com/nexo"
              required
            />
            {error && <p className="error-text">{error}</p>}
          </div>
          <button type="submit" className="btn btn-primary field-action" disabled={busy || !url.trim()}>
            {busy ? "Saving…" : config.configured ? "Update" : "Save"}
          </button>
        </div>
      </form>

      {config.configured && (
        <>
          <div className="field-row">
            <span className="field-label">Signing secret</span>
            <div className="field-control">
              <div className="field-inline">
                <input
                  className="mono"
                  readOnly
                  aria-label="Signing secret"
                  type={secretShown ? "text" : "password"}
                  value={config.secret}
                />
                <button type="button" className="btn-small" onClick={() => setSecretShown((v) => !v)}>
                  {secretShown ? "Hide" : "Show"}
                </button>
              </div>
              <p className="field-help">
                Every request carries <code>X-Nexo-Signature</code>, an HMAC-SHA256 of{" "}
                <code>timestamp.body</code> using this secret. Verify it before trusting a request.
              </p>
            </div>
          </div>

          <div className="webhook-actions">
            <button type="button" className="btn-small" onClick={sendTest} disabled={busy}>
              {busy ? "Sending…" : "Send test event"}
            </button>
            <button type="button" className="btn-small danger" onClick={remove} disabled={busy}>
              Remove
            </button>
            {testResult && <span className="webhook-test-result">{testResult}</span>}
          </div>

          <div className="webhook-deliveries">
            <div className="wd-head">Recent deliveries</div>
            {config.deliveries.length === 0 && (
              <p className="empty-note">Nothing sent yet. Send a test event to check the endpoint.</p>
            )}
            {config.deliveries.map((d) => (
              <div className="wd-row" key={d.id}>
                <span className={`badge ${d.status === "succeeded" ? "resolved" : "escalated"}`}>
                  {d.status === "succeeded" ? d.statusCode ?? "ok" : "failed"}
                </span>
                <span className="wd-event mono">{d.event}</span>
                <span className="wd-detail">
                  {d.status === "succeeded"
                    ? `${d.durationMs} ms`
                    : `${d.error ?? "no response"} · ${d.attempts} attempts`}
                </span>
                <span className="wd-when">{when(d.createdAt)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
