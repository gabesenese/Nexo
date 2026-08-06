import { useEffect, useState } from "react";
import { WizardShell } from "../WizardShell";

export function IndexingStep({
  onNext,
  onBack,
  skipped,
}: {
  onNext: () => void;
  onBack: () => void;
  skipped: boolean;
}) {
  const [progress, setProgress] = useState(skipped ? 100 : 0);

  useEffect(() => {
    if (skipped) return;
    const start = Date.now();
    const durationMs = 2600;
    const id = setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - start) / durationMs) * 100));
      setProgress(pct);
      if (pct >= 100) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [skipped]);

  const done = progress >= 100;

  return (
    <WizardShell
      step={4}
      total={7}
      title={skipped ? "Nothing to index yet" : "Indexing your knowledge"}
      subtitle={
        skipped
          ? "You can add a knowledge source anytime from the dashboard."
          : "Nexo is reading and chunking what you gave it so it can cite the right answer later."
      }
    >
      {!skipped && (
        <>
          <div className="onboard-progressbar">
            <div className="onboard-progressbar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="onboard-indexing-status">
            <span>{done ? "Done" : "Learning…"}</span>
            <span>{done ? "100%" : `${progress}% · est. 40s`}</span>
          </div>
        </>
      )}

      <div className="onboard-actions">
        <button type="button" className="onboard-back" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" disabled={!done} onClick={onNext}>
          Continue
        </button>
      </div>
    </WizardShell>
  );
}
