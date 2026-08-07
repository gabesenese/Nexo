import { WizardShell } from "../WizardShell";

export function TestNexoStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <WizardShell
      step={5}
      total={7}
      title="See it work"
      subtitle="An example of what your customers will see — a confident answer, and an honest escalation."
      wide
    >
      <div className="onboard-chat">
        <div className="msg user">What's your return policy?</div>
        <div className="msg bot">
          Returns are accepted within 30 days of delivery for unworn items with tags.
          <div className="cite">source: Return Policy §2</div>
        </div>
        <div className="msg user">Can I get a refund for a custom order after 60 days?</div>
        <div className="msg bot">
          I can see our standard return policy, but this is a custom order past the window, which needs a person to
          review.
        </div>
        <div className="escalation-note">
          <strong>low confidence</strong> — routed to a human instead of guessing
        </div>
      </div>

      <div className="onboard-actions">
        <button type="button" className="onboard-back" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Continue
        </button>
      </div>
    </WizardShell>
  );
}
