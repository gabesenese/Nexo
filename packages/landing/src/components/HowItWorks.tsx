const STEPS = [
  { n: "01", label: "Customer asks" },
  { n: "02", label: "Nexo searches your knowledge" },
  { n: "03", label: "Nexo checks its confidence" },
];

export function HowItWorks() {
  return (
    <section className="l-section how-section">
      <div className="l-section-head how-section-head">
        <h2>From question to resolution.</h2>
      </div>

      <div className="how-grid">
        {STEPS.map((step) => (
          <div className="how-card" key={step.n}>
            <div className="how-card-n">{step.n}</div>
            <div className="how-card-label">{step.label}</div>
          </div>
        ))}

        <div className="how-card how-card-branch">
          <div className="how-card-n">04</div>
          <div className="how-branch-row">
            <div className="how-branch confident">
              <div className="how-branch-label">Confident</div>
              <div className="how-branch-outcome">Nexo answers</div>
            </div>
            <div className="how-branch unsure">
              <div className="how-branch-label">Unsure</div>
              <div className="how-branch-outcome">Hands off to a human</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
