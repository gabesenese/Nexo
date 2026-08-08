import { useEffect, useRef, useState } from "react";
import { api, sourceStatusLabel, type SourceSummary } from "../../api";
import { WizardShell } from "../WizardShell";

type Method = "help_center" | "pdf" | "skip";

interface IndexResult {
  sourceName: string;
  chunkCount: number;
}

const POLL_MS = 1200;

export function IndexingStep({
  method,
  helpCenterUrl,
  file,
  onDone,
}: {
  method: Method;
  helpCenterUrl?: string;
  file: File | null;
  onDone: (result: IndexResult) => void;
}) {
  const skipped = method === "skip";
  const [status, setStatus] = useState<"running" | "done" | "error">(skipped ? "done" : "running");
  const [source, setSource] = useState<SourceSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const started = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopPolling() {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }

  async function pollUntilSettled(sourceId: string) {
    const sources = await api.listSources();
    const current = sources.find((s) => s.id === sourceId);
    if (!current) return;
    setSource(current);

    if (current.status === "ready") {
      setStatus("done");
      return;
    }
    if (current.status === "failed") {
      setErrorMsg(current.errorMessage ?? "We couldn't finish indexing that source.");
      setStatus("error");
      return;
    }
    pollTimer.current = setTimeout(() => pollUntilSettled(sourceId), POLL_MS);
  }

  async function run() {
    setStatus("running");
    setErrorMsg("");
    setSource(null);
    try {
      const queued =
        method === "help_center"
          ? await api.addHelpCenterUrl(helpCenterUrl ?? "")
          : method === "pdf" && file
            ? await api.uploadPdf(file)
            : null;
      if (!queued) throw new Error("No knowledge source to index.");
      await pollUntilSettled(queued.sourceId);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStatus("error");
    }
  }

  useEffect(() => {
    if (skipped || started.current) return;
    started.current = true;
    run();
    return stopPolling;
  }, [skipped]);

  const title = skipped
    ? "Nothing to index yet"
    : status === "done"
      ? "Your knowledge is indexed"
      : status === "error"
        ? "Indexing didn't finish"
        : "Indexing your knowledge";

  const subtitle = skipped
    ? "You can add a knowledge source anytime from the dashboard."
    : status === "running"
      ? "Nexo is reading, chunking, and embedding what you gave it. This can take a few seconds."
      : status === "error"
        ? "We couldn't read that source."
        : "Nexo can now cite this when it answers.";

  return (
    <WizardShell step={4} total={7} title={title} subtitle={subtitle}>
      {!skipped && status === "running" && (
        <div className="onboard-indexing-live">
          <span className="notice-spinner" aria-hidden />
          <span>
            {source ? sourceStatusLabel(source.status) : "Queued…"}
            {source?.status === "embedding" && source.totalChunks
              ? ` ${source.processedChunks}/${source.totalChunks} chunks`
              : ""}
          </span>
        </div>
      )}

      {!skipped && status === "done" && source && (
        <div className="onboard-index-result">
          <div className="oir-mark">✓</div>
          <div>
            <div className="oir-title">{source.name}</div>
            <div className="oir-sub">
              {source.chunkCount} chunk{source.chunkCount === 1 ? "" : "s"} added to Nexo's knowledge
            </div>
          </div>
        </div>
      )}

      {!skipped && status === "error" && <p className="error-text">{errorMsg}</p>}

      <div className="onboard-actions">
        <span />
        {status === "error" ? (
          <button type="button" className="btn btn-primary" onClick={run}>
            Try again
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={status === "running"}
            onClick={() =>
              onDone(
                source ? { sourceName: source.name, chunkCount: source.chunkCount } : { sourceName: "", chunkCount: 0 },
              )
            }
          >
            Continue
          </button>
        )}
      </div>
    </WizardShell>
  );
}
