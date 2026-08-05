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
      <h1>Knowledge sources</h1>

      <div className="card">
        <h3>Add a help-center article (URL)</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            style={{ flex: 1 }}
            placeholder="https://help.example.com/article/refunds"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button onClick={handleAddUrl} disabled={busy}>
            {busy ? "Ingesting..." : "Add"}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Upload a PDF</h3>
        <input type="file" accept="application/pdf" onChange={handleUpload} disabled={busy} />
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      <div className="card">
        <h3>Ingested sources</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Chunks</th>
              <th>Last synced</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.type}</td>
                <td>{s.chunkCount}</td>
                <td>{s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString() : "Not synced"}</td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "#6b7280" }}>
                  No sources yet. Add a help-center URL or upload a PDF above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
