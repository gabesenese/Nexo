import { useState } from "react";
import { WizardShell } from "../WizardShell";

type Method = "help_center" | "pdf" | "skip";

export function ImportKnowledgeStep({
  onNext,
  onBack,
  defaults,
}: {
  onNext: (data: { method: Method; helpCenterUrl?: string; pdfName?: string }) => void;
  onBack: () => void;
  defaults: { method?: Method; helpCenterUrl?: string };
}) {
  const [method, setMethod] = useState<Method | null>(defaults.method ?? null);
  const [helpCenterUrl, setHelpCenterUrl] = useState(defaults.helpCenterUrl ?? "");
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [error, setError] = useState("");

  function handleContinue() {
    if (method === "help_center") {
      if (!helpCenterUrl.trim()) return setError("Enter your help center URL.");
      setError("");
      return onNext({ method, helpCenterUrl: helpCenterUrl.trim() });
    }
    if (method === "pdf") {
      if (!pdfName) return setError("Choose a PDF to upload.");
      setError("");
      return onNext({ method, pdfName });
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
          <div className="oo-icon">📚</div>
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
          <div className="oo-icon">📄</div>
          <div>
            <div className="oo-title">PDF documentation</div>
            <div className="oo-sub">Return policies, guides, anything written</div>
          </div>
        </button>
        {method === "pdf" && (
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdfName(e.target.files?.[0]?.name ?? null)}
          />
        )}

        <button
          type="button"
          className={`onboard-option${method === "skip" ? " selected" : ""}`}
          onClick={() => setMethod("skip")}
        >
          <div className="oo-icon">→</div>
          <div>
            <div className="oo-title">Skip for now</div>
            <div className="oo-sub">Add knowledge later from the dashboard</div>
          </div>
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="onboard-actions">
        <button type="button" className="onboard-back" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" disabled={!method} onClick={handleContinue}>
          Continue
        </button>
      </div>
    </WizardShell>
  );
}
