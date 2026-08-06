import type { ReactNode } from "react";

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#2f6f5e" strokeWidth="1.4" />
      <path d="M6 13V7l8 6V7" stroke="#181b1d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
          <LogoMark />
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
