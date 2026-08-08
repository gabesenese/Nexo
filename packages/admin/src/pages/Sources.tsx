import { useEffect, useState } from "react";
import { api, type SourceSummary } from "../api";

type Notice =
  | { tone: "info"; text: string }
  | { tone: "success"; text: string }
  | { tone: "error"; text: string };

export function SourcesPage() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function refresh() {
    setSources(await api.listSources());
    setLoaded(true);
  }

  useEffect(() => {
    refresh();
  }, []);

  function reportIndexed(name: string, chunkCount: number) {
    if (chunkCount === 0) {
      setNotice({ tone: "error", text: `Indexed “${name}” but found no readable content. Check the file or URL.` });
    } else {
      setNotice({
        tone: "success",
        text: `Indexed “${name}”. ${chunkCount} chunk${chunkCount === 1 ? "" : "s"} added to Nexo's knowledge.`,
      });
    }
  }

  async function handleAddUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setNotice({ tone: "info", text: "Fetching the page, chunking, and embedding it. This can take a few seconds." });
    try {
      const result = await api.addHelpCenterUrl(url.trim());
      setUrl("");
      await refresh();
      reportIndexed(result.name, result.chunkCount);
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNotice({ tone: "info", text: `Reading “${file.name}”, chunking, and embedding it. This can take a few seconds.` });
    try {
      const result = await api.uploadPdf(file);
      await refresh();
      reportIndexed(result.name, result.chunkCount);
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function handleDelete(source: SourceSummary) {
    const ok = window.confirm(
      `Delete “${source.name}”? Nexo will stop answering from it. This can't be undone.`,
    );
    if (!ok) return;
    setDeletingId(source.id);
    setNotice(null);
    try {
      await api.deleteSource(source.id);
      await refresh();
      setNotice({ tone: "success", text: `Removed “${source.name}” from Nexo's knowledge.` });
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setDeletingId(null);
    }
  }

  const showEmptyHero = loaded && sources.length === 0;

  return (
    <div>
      <div className="page-top">
        <div>
          <h1>Knowledge</h1>
          <div className="sub">Teach Nexo by adding the sources it should answer from</div>
        </div>
      </div>

      {showEmptyHero && (
        <div className="empty-hero">
          <div className="eh-mark">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 3.5h9a2 2 0 0 1 2 2V16l-3.5-2H4a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
                stroke="#2f6f5e"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="M6 7.5h6M6 10.5h4" stroke="#181b1d" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <h2>Teach Nexo what it knows</h2>
          <p>
            Nexo answers only from what you give it. Add a help-center article or upload a PDF below, and
            it's fetched, split into chunks, and embedded so the widget can cite it in real answers.
          </p>
          <div className="setup-steps">
            <div className="setup-step">
              <span className="ss-num">1</span>
              Add a URL or upload a PDF
            </div>
            <div className="setup-step">
              <span className="ss-num">2</span>
              Watch it index
            </div>
            <div className="setup-step">
              <span className="ss-num">3</span>
              Ask a question in the widget
            </div>
          </div>
        </div>
      )}

      <div className="row">
        <div className="card">
          <h3>Add a help-center article</h3>
          <div className="card-sub">Paste a URL. It's fetched, chunked, and embedded.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              style={{ flex: 1 }}
              placeholder="https://help.example.com/article/refunds"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && handleAddUrl()}
              disabled={busy}
            />
            <button className="btn btn-primary" onClick={handleAddUrl} disabled={busy}>
              {busy ? "Indexing…" : "Add"}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Upload a PDF</h3>
          <div className="card-sub">Return policies, warranty terms, and the like.</div>
          <input type="file" accept="application/pdf" onChange={handleUpload} disabled={busy} />
        </div>
      </div>

      {notice && (
        <div className={`notice notice-${notice.tone}`}>
          {notice.tone === "info" && <span className="notice-spinner" aria-hidden />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="card">
        <h3>Ingested sources</h3>
        <div className="card-sub">
          {sources.length} source{sources.length === 1 ? "" : "s"}
        </div>
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
            <button
              className="btn-small danger"
              onClick={() => handleDelete(s)}
              disabled={deletingId === s.id}
            >
              {deletingId === s.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        ))}
        {loaded && sources.length === 0 && (
          <p className="empty-note">No sources yet. Add a help-center URL or upload a PDF above.</p>
        )}
      </div>
    </div>
  );
}
