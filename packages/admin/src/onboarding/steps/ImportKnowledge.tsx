import { useState } from "react";
import { WizardShell } from "../WizardShell";

type Method = "help_center" | "pdf" | "skip";

export function ImportKnowledgeStep({
  onNext,
  defaults,
}: {
  onNext: (data: { method: Method; helpCenterUrl?: string; file?: File }) => void;
  defaults: { method?: Method; helpCenterUrl?: string };
}) {
  const [method, setMethod] = useState<Method | null>(defaults.method ?? null);
  const [helpCenterUrl, setHelpCenterUrl] = useState(defaults.helpCenterUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  function handleContinue() {
    if (method === "help_center") {
      if (!helpCenterUrl.trim()) return setError("Enter your help center URL.");
      setError("");
      return onNext({ method, helpCenterUrl: helpCenterUrl.trim() });
    }
    if (method === "pdf") {
      if (!file) return setError("Choose a PDF to upload.");
      setError("");
      return onNext({ method, file });
    }
    onNext({ method: "skip" });
  }

  return (
    <WizardShell step={3} total={7} title="Import your knowledge" subtitle="Nexo answers from what you already have written down.">
      <div className="onboard-option-grid">
        <button
          type="button"
          className={`onboard-option${method === "help_center" ? " selected" : ""}`}
          onClick={() => setMethod("help_center")}
        >
          <div className="oo-icon">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M4 3.5h9a2 2 0 0 1 2 2V16l-3.5-2H4a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
                stroke="var(--ok)"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="M6 7.5h6M6 10.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="oo-title">Help Center</div>
            <div className="oo-sub">Point us at your existing articles</div>
          </div>
        </button>
        {method === "help_center" && (
          <input
            type="text"
            placeholder="https://help.yourcompany.com"
            value={helpCenterUrl}
            onChange={(e) => setHelpCenterUrl(e.target.value)}
          />
        )}

        <button
          type="button"
          className={`onboard-option${method === "pdf" ? " selected" : ""}`}
          onClick={() => setMethod("pdf")}
        >
          <div className="oo-icon">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 2.5h6l4 4V17a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 5 17V3a.5.5 0 0 1 .5-.5Z"
                stroke="var(--ok)"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="M11 2.5V7h4M7.5 11h5M7.5 13.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="oo-title">PDF documentation</div>
            <div className="oo-sub">Return policies, guides, anything written</div>
          </div>
        </button>
        {method === "pdf" && (
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        )}

        <button
          type="button"
          className={`onboard-option${method === "skip" ? " selected" : ""}`}
          onClick={() => setMethod("skip")}
        >
          <div className="oo-icon">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3.5 10h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path d="m11.5 6 4 4-4 4" stroke="var(--ok)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="oo-title">Skip for now</div>
            <div className="oo-sub">Add knowledge later from the dashboard</div>
          </div>
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="onboard-actions">
        <span />
        <button type="button" className="btn btn-primary" disabled={!method} onClick={handleContinue}>
          Continue
        </button>
      </div>
    </WizardShell>
  );
}
