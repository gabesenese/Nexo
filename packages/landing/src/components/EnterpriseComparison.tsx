const ROWS: [string, string][] = [
  ["Complex implementation", "Start yourself"],
  ["Dedicated AI teams", "Your support team"],
  ["Long deployments", "Days"],
  ["Expensive contracts", "Transparent pricing"],
  ["Hundreds of integrations", "Start with your existing knowledge"],
];

export function EnterpriseComparison() {
  return (
    <section className="l-section growing-section">
      <div className="l-section-head">
        <h2>You don't need an enterprise support operation.</h2>
      </div>
      <div className="growing-table">
        <div className="growing-row growing-head">
          <div>Enterprise platforms</div>
          <div>Nexo</div>
        </div>
        {ROWS.map(([left, right]) => (
          <div className="growing-row" key={left}>
            <div className="growing-cell left">{left}</div>
            <div className="growing-cell right">{right}</div>
          </div>
        ))}
      </div>
      <p className="growing-signature">The same outcome. A different starting point.</p>
    </section>
  );
}
