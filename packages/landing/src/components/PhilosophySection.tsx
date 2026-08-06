export function PhilosophySection() {
  return (
    <section className="l-section why-section" id="product">
      <h2>
        Customers don't care if it's AI or a human.
        <span className="accent">They care about getting an answer.</span>
      </h2>
      <div className="why-lines">
        <p className="why-line">Nexo answers when it's confident.</p>
        <p className="why-line resolve">Nexo escalates when it isn't.</p>
      </div>

      <h3 className="compare-heading">Enterprise software makes enterprise assumptions.</h3>

      <div className="compare-grid">
        <div className="compare-col">
          <div className="compare-label">Enterprise platforms assume</div>
          <ul className="compare-list">
            <li>Dedicated AI teams</li>
            <li>Long implementations</li>
            <li>Expensive contracts</li>
          </ul>
        </div>
        <div className="compare-col hi">
          <div className="compare-label">Growing businesses need</div>
          <ul className="compare-list">
            <li>Live in days, not months</li>
            <li>Simple enough to manage yourself</li>
            <li>Confidence they won't lose customers</li>
          </ul>
        </div>
      </div>

      <div className="conf-flow">
        <div className="cf-step">Customer asks a question</div>
        <div className="cf-arrow">↓</div>
        <div className="cf-step">Nexo checks its confidence</div>
        <div className="cf-arrow">↓</div>
        <div className="cf-branches">
          <div className="cf-branch">
            <div className="cf-conf high">High confidence</div>
            <div className="cf-outcome">Answered automatically</div>
          </div>
          <div className="cf-branch">
            <div className="cf-conf low">Low confidence</div>
            <div className="cf-outcome">Escalated automatically</div>
          </div>
        </div>
      </div>

      <p className="why-signature">
        The smartest AI isn't the one that answers every question.
        <br />
        It's the one that knows when not to.
      </p>
    </section>
  );
}
