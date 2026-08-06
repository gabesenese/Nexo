import { useEffect, useState } from "react";
import { api, type SourceSummary } from "../api";

export function SourcesPage() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setSources(await api.listSources());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAddUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addHelpCenterUrl(url.trim());
      setUrl("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadPdf(file);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <div className="page-top">
        <div>
          <h1>Knowledge</h1>
          <div className="sub">Sources Nexo answers from</div>
        </div>
      </div>

      <div className="row">
        <div className="card">
          <h3>Add a help-center article</h3>
          <div className="card-sub">Paste a URL — it's fetched, chunked, and embedded.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              style={{ flex: 1 }}
              placeholder="https://help.example.com/article/refunds"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleAddUrl} disabled={busy}>
              {busy ? "Ingesting…" : "Add"}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Upload a PDF</h3>
          <div className="card-sub">Return policies, warranty terms, and the like.</div>
          <input type="file" accept="application/pdf" onChange={handleUpload} disabled={busy} />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <h3>Ingested sources</h3>
        <div className="card-sub">{sources.length} source{sources.length === 1 ? "" : "s"}</div>
        {sources.map((s) => (
          <div className="list-item" key={s.id}>
            <div className="avatar mono">{s.type === "pdf" ? "PDF" : "HC"}</div>
            <div className="list-info">
              <div className="li-title">{s.name}</div>
              <div className="li-sub">
                {s.chunkCount} chunk{s.chunkCount === 1 ? "" : "s"} ·{" "}
                {s.lastSyncedAt ? `synced ${new Date(s.lastSyncedAt).toLocaleString()}` : "not synced"}
              </div>
            </div>
            <span className={`badge ${s.lastSyncedAt ? "healthy" : "escalated"}`}>
              {s.lastSyncedAt ? "healthy" : "pending"}
            </span>
          </div>
        ))}
        {sources.length === 0 && (
          <p className="empty-note">No sources yet. Add a help-center URL or upload a PDF above.</p>
        )}
      </div>
    </div>
  );
}
