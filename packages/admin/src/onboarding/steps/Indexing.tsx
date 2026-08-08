import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { WizardShell } from "../WizardShell";

type Method = "help_center" | "pdf" | "skip";

interface IndexResult {
  sourceName: string;
  chunkCount: number;
}

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
  const [result, setResult] = useState<IndexResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const started = useRef(false);

  async function run() {
    setStatus("running");
    setErrorMsg("");
    try {
      let res: { name: string; chunkCount: number };
      if (method === "help_center") {
        res = await api.addHelpCenterUrl(helpCenterUrl ?? "");
      } else if (method === "pdf" && file) {
        res = await api.uploadPdf(file);
      } else {
        throw new Error("No knowledge source to index.");
      }
      setResult({ sourceName: res.name, chunkCount: res.chunkCount });
      setStatus("done");
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStatus("error");
    }
  }

  useEffect(() => {
    if (skipped || started.current) return;
    started.current = true;
    run();
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
          <span>Learning from your content…</span>
        </div>
      )}

      {!skipped && status === "done" && result && (
        <div className="onboard-index-result">
          <div className="oir-mark">✓</div>
          <div>
            <div className="oir-title">{result.sourceName}</div>
            <div className="oir-sub">
              {result.chunkCount} chunk{result.chunkCount === 1 ? "" : "s"} added to Nexo's knowledge
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
            onClick={() => onDone(result ?? { sourceName: "", chunkCount: 0 })}
          >
            Continue
          </button>
        )}
      </div>
    </WizardShell>
  );
}
