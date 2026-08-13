import { useEffect, useRef, useState } from "react";
import { api, sourceStatusLabel, type SourceSummary } from "../api";

type Notice =
  | { tone: "info"; text: string }
  | { tone: "success"; text: string }
  | { tone: "error"; text: string };

function statusBadgeClass(status: SourceSummary["status"]) {
  switch (status) {
    case "ready":
      return "healthy";
    case "failed":
      return "escalated";
    case "queued":
      return "neutral";
    default:
      return "active";
  }
}

function progressLabel(source: SourceSummary): string {
  if (source.status === "embedding" && source.totalChunks) {
    return `Embedding… ${source.processedChunks}/${source.totalChunks} chunks`;
  }
  return sourceStatusLabel(source.status);
}

export function SourcesPage() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeSourceId = useRef<string | null>(null);

  async function refresh() {
    const next = await api.listSources();
    setSources(next);
    setLoaded(true);

    if (noticeSourceId.current) {
      const watched = next.find((s) => s.id === noticeSourceId.current);
      if (watched && watched.status !== "queued" && watched.status !== "fetching" && watched.status !== "chunking" && watched.status !== "embedding") {
        setNotice(
          watched.status === "ready"
            ? {
                tone: "success",
                text: watched.notice
                  ? `“${watched.name}” is ready. ${watched.notice}`
                  : `“${watched.name}” is ready. Nexo can now answer from it.`,
              }
            : { tone: "error", text: watched.errorMessage ?? `“${watched.name}” failed to index.` },
        );
        noticeSourceId.current = null;
      }
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  async function handleAddUrl() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const queued = await api.addHelpCenterUrl(url.trim());
      setUrl("");
      noticeSourceId.current = queued.sourceId;
      setNotice({ tone: "info", text: "Queued. Nexo is fetching, chunking, and embedding it now." });
      await refresh();
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function isPdf(file: File) {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  }

  async function uploadFile(file: File) {
    if (!isPdf(file)) {
      setNotice({ tone: "error", text: `“${file.name}” is not a PDF. Nexo can only read PDFs here.` });
      return;
    }
    setBusy(true);
    try {
      const queued = await api.uploadPdf(file);
      noticeSourceId.current = queued.sourceId;
      setNotice({ tone: "info", text: `Queued “${file.name}”. Nexo is reading, chunking, and embedding it now.` });
      await refresh();
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    /** Cleared so picking the same file twice in a row still fires a change event. */
    e.target.value = "";
    if (file) await uploadFile(file);
  }

  async function handleReindex(source: SourceSummary) {
    setReindexingId(source.id);
    setNotice(null);
    try {
      await api.reindexSource(source.id);
      noticeSourceId.current = source.id;
      setNotice({ tone: "info", text: `Re-indexing “${source.name}”.` });
      await refresh();
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setReindexingId(null);
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
      if (selectedId === source.id) setSelectedId(null);
      await refresh();
      setNotice({ tone: "success", text: `Removed “${source.name}” from Nexo's knowledge.` });
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setDeletingId(null);
    }
  }

  const showEmptyHero = loaded && sources.length === 0;
  const selected = sources.find((s) => s.id === selectedId) ?? null;

  return (
    <div>
      <div className="page-top">
        <div>
          <h1>Sources</h1>
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
              {busy ? "Queuing…" : "Add"}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Upload a PDF</h3>
          <div className="card-sub">Return policies, warranty terms, and the like.</div>
          {/**
           * The native file input renders as a browser-chrome button that
           * matches nothing else here and cannot accept a drag. This is a
           * label wrapping a visually-hidden input, so it stays a real file
           * control for the keyboard and for screen readers.
           */}
          <label
            className={`dropzone${dragging ? " dragging" : ""}${busy ? " busy" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={handleUpload}
              disabled={busy}
              className="dropzone-input"
            />
            <span className="dropzone-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 13.5V4m0 0L6.5 7.5M10 4l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3.5 12.5v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="dropzone-text">
              <strong>{busy ? "Uploading…" : dragging ? "Drop to upload" : "Choose a PDF"}</strong>
              <span className="dropzone-hint">or drag one here</span>
            </span>
          </label>
        </div>
      </div>

      {notice && (
        <div className={`notice notice-${notice.tone}`}>
          {notice.tone === "info" && <span className="notice-spinner" aria-hidden />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="card">
          <h3>Ingested sources</h3>
          <div className="card-sub">
            {sources.length} source{sources.length === 1 ? "" : "s"}
          </div>
          {sources.map((s) => (
            <div
              className={`list-item${s.id === selectedId ? " selected" : ""}`}
              key={s.id}
              data-clickable
              onClick={() => setSelectedId(s.id)}
            >
              <div className="avatar mono">{s.type === "pdf" ? "PDF" : "HC"}</div>
              <div className="list-info">
                <div className="li-title">{s.name}</div>
                <div className="li-sub">
                  {s.status === "ready" || s.status === "failed"
                    ? `${s.chunkCount} chunk${s.chunkCount === 1 ? "" : "s"} · ${
                        s.lastSyncedAt ? `indexed ${new Date(s.lastSyncedAt).toLocaleString()}` : "never indexed"
                      }`
                    : progressLabel(s)}
                </div>
                {/**
                 * Whether a source is actually earning its place. A source
                 * that has never been cited is either redundant or not
                 * reaching the questions people ask.
                 */}
                {s.status === "ready" && (
                  <div className="source-usage">
                    {s.answersCited > 0
                      ? `Cited in ${s.answersCited} answer${s.answersCited === 1 ? "" : "s"}`
                      : "Not cited in any answer yet"}
                  </div>
                )}
              </div>
              <span className={`badge ${statusBadgeClass(s.status)}`}>{sourceStatusLabel(s.status)}</span>
            </div>
          ))}
          {loaded && sources.length === 0 && (
            <p className="empty-note">No sources yet. Add a help-center URL or upload a PDF above.</p>
          )}
        </div>

        {selected && (
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3>{selected.name}</h3>
              <span className={`badge ${statusBadgeClass(selected.status)}`}>
                {sourceStatusLabel(selected.status)}
              </span>
            </div>
            <div className="card-sub">{selected.type === "pdf" ? "PDF" : "Help center article"}</div>

            <dl className="source-detail">
              <dt>Origin</dt>
              <dd>{selected.origin}</dd>
              <dt>Chunks</dt>
              <dd>
                {selected.status === "embedding" && selected.totalChunks
                  ? `${selected.processedChunks} / ${selected.totalChunks}`
                  : selected.chunkCount}
              </dd>
              <dt>Last indexed</dt>
              <dd>{selected.lastSyncedAt ? new Date(selected.lastSyncedAt).toLocaleString() : "Never"}</dd>
              <dt>Added</dt>
              <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
            </dl>

            {selected.status === "failed" && selected.errorMessage && (
              <p className="error-text">{selected.errorMessage}</p>
            )}

            {selected.notice && <p className="source-note">{selected.notice}</p>}

            <div className="reply-actions">
              {selected.type === "help_center" && (
                <button
                  className="btn-small"
                  onClick={() => handleReindex(selected)}
                  disabled={
                    reindexingId === selected.id || (selected.status !== "ready" && selected.status !== "failed")
                  }
                >
                  {reindexingId === selected.id ? "Re-indexing…" : "Re-index"}
                </button>
              )}
              <button
                className="btn-small danger"
                onClick={() => handleDelete(selected)}
                disabled={deletingId === selected.id}
              >
                {deletingId === selected.id ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
