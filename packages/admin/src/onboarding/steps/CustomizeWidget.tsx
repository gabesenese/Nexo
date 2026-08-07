import { useState } from "react";
import { WizardShell } from "../WizardShell";

const COLORS = ["#204c40", "#2f6f5e", "#c9873a", "#181b1d", "#2b3f8a"];

export function CustomizeWidgetStep({
  onNext,
  onBack,
  defaults,
}: {
  onNext: (data: { color: string; welcomeMessage: string }) => void;
  onBack: () => void;
  defaults: { color: string; welcomeMessage: string };
}) {
  const [color, setColor] = useState(defaults.color || COLORS[0]);
  const [welcomeMessage, setWelcomeMessage] = useState(
    defaults.welcomeMessage || "Hi! Ask me anything — I'll loop in a person if I'm not sure.",
  );

  return (
    <WizardShell step={6} total={7} title="Customize your widget" subtitle="This is what your customers will see." wide>
      <div className="field">
        <label>Accent color</label>
        <div className="onboard-swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`onboard-swatch${color === c ? " selected" : ""}`}
              style={{ background: c }}
              aria-label={`Choose ${c}`}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="ob-welcome">Welcome message</label>
        <input id="ob-welcome" type="text" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
      </div>

      <div className="onboard-widget-preview">
        <div className="owp-head" style={{ background: color }}>
          <div className="owp-mark">N</div>
          Support
        </div>
        <div className="owp-body">{welcomeMessage}</div>
      </div>

      <div className="onboard-actions">
        <button type="button" className="onboard-back" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onNext({ color, welcomeMessage })}>
          Continue
        </button>
      </div>
    </WizardShell>
  );
}
