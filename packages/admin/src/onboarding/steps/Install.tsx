import { useState } from "react";
import { WizardShell } from "../WizardShell";

const SNIPPET = `<script src="http://localhost:5174/dist/widget.js" data-api-url="http://localhost:4000"></script>`;

export function InstallStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleVerify() {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
    }, 1200);
  }

  if (verified) {
    return (
      <WizardShell step={7} total={7} title="You're all set" subtitle="Nexo is live on your site.">
        <div style={{ textAlign: "center" }}>
          <div className="onboard-done-icon">✓</div>
          <p style={{ color: "var(--slate-soft)", fontSize: 13.5 }}>
            Your widget is installed. In the real product, this is where you'd land in your workspace dashboard and
            watch conversations come in.
          </p>
        </div>
        <div className="onboard-actions">
          <span />
          <button type="button" className="btn btn-primary" onClick={onFinish}>
            Start over
          </button>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      step={7}
      total={7}
      title="Install the widget"
      subtitle="One script tag. Paste it before the closing </body> tag on your site."
    >
      <div className="onboard-code">
        <div className="onboard-code-text">{SNIPPET}</div>
        <button type="button" className="onboard-copy" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {verifying && (
        <div className="onboard-verify">
          <span className="ov-spinner" />
          Checking for the widget on your site…
        </div>
      )}

      <div className="onboard-actions">
        <button type="button" className="onboard-back" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" disabled={verifying} onClick={handleVerify}>
          {verifying ? "Verifying…" : "Verify installation"}
        </button>
      </div>
    </WizardShell>
  );
}
