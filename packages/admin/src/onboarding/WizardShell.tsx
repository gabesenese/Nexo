import type { ReactNode } from "react";
import { Mark } from "../components/Mark";


export function WizardShell({
  step,
  total,
  title,
  subtitle,
  children,
  wide,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="onboard-screen">
      <div className={`onboard-card${wide ? " wide" : ""}`}>
        <div className="onboard-brand">
          <Mark />
          Nexo
        </div>
        <div className="onboard-progress">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`onboard-dot${i < step ? " done" : ""}${i === step - 1 ? " active" : ""}`} />
          ))}
        </div>
        <div className="onboard-step-label">
          Step {step} of {total}
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="onboard-sub">{subtitle}</p>}
        <div className="onboard-body">{children}</div>
      </div>
    </div>
  );
}
