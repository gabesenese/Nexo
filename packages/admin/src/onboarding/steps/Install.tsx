import { useState } from "react";
import { WizardShell } from "../WizardShell";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const WIDGET_SRC = import.meta.env.VITE_WIDGET_URL ?? `${API_URL}/widget.js`;

export function InstallStep({
  orgKey,
  onBack,
  onFinish,
}: {
  orgKey: string;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${WIDGET_SRC}" data-api-url="${API_URL}" data-org-key="${orgKey}"></script>`;

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <WizardShell
      step={7}
      total={7}
      title="Install the widget"
      subtitle="One script tag, keyed to your workspace. Paste it before the closing </body> tag on your site."
    >
      <div className="onboard-code">
        <div className="onboard-code-text">{snippet}</div>
        <button type="button" className="onboard-copy" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="empty-note" style={{ marginTop: 4 }}>
        The <code>data-org-key</code> ties the widget to your knowledge, so it only ever answers from your sources.
      </p>

      <div className="onboard-actions">
        <button type="button" className="onboard-back" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" onClick={onFinish}>
          Go to your dashboard →
        </button>
      </div>
    </WizardShell>
  );
}
