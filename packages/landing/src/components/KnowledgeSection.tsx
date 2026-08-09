const AVAILABLE_TODAY = ["Help Center", "PDF documentation"];
const COMING_NEXT = ["Zendesk", "Intercom", "Stripe", "Notion", "Slack", "GitHub", "Linear"];

export function KnowledgeSection() {
  return (
    <section className="l-section knowledge-section" id="knowledge">
      <div className="ks-head">
        <h2>Teach Nexo using the knowledge you already have.</h2>
        <p>Your AI is only as good as what it knows.</p>
      </div>

      <div className="ks-label">Available today</div>
      <div className="ks-row">
        {AVAILABLE_TODAY.map((name) => (
          <span className="ks-chip" key={name}>
            ✓ {name}
          </span>
        ))}
      </div>

      <div className="ks-label muted">Coming next</div>
      <div className="ks-row">
        {COMING_NEXT.map((name) => (
          <span className="ks-chip soon" key={name}>
            {name}
          </span>
        ))}
      </div>

      <div className="ks-trust">Your knowledge stays yours.</div>
    </section>
  );
}
