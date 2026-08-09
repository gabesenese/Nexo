const ARCHITECTURE = ["Customer", "Knowledge", "AI Answer", "Confidence", "Human", "Analytics"];

const CAPABILITIES = [
  { title: "AI Answers", body: "Answers from your company's knowledge, with sources cited." },
  { title: "Human Handoff", body: "Escalates when Nexo isn't confident, full context included." },
  { title: "Knowledge", body: "Teach Nexo from the help center and documentation you already have." },
  { title: "Conversation Inbox", body: "See every customer interaction, live and resolved, in one place." },
  { title: "Analytics", body: "Understand what Nexo resolves, what it escalates, and why." },
  { title: "Widget", body: "One script tag. Deploy directly to your website." },
];

export function PlatformGrid() {
  return (
    <section className="l-section platform-section">
      <div className="l-section-head">
        <h2>One support system, built around resolution.</h2>
      </div>

      <div className="arch-strip">
        {ARCHITECTURE.map((node, i) => (
          <div className="arch-node" key={node}>
            <span>{node}</span>
            {i < ARCHITECTURE.length - 1 && <span className="arch-arrow">→</span>}
          </div>
        ))}
      </div>

      <div className="platform-grid">
        {CAPABILITIES.map((c) => (
          <div className="platform-card" key={c.title}>
            <div className="platform-card-title">{c.title}</div>
            <div className="platform-card-body">{c.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
